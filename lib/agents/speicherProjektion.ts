/**
 * Speicherprojektion — Supabase ↔ Memory-Store ↔ Files
 * ====================================================
 *
 * Die Regel dahinter steht in docs/speicherorte.md. Kurzfassung:
 *
 *   Supabase ist das System of Record.
 *   Der Memory-Store ist der Arbeitsspeicher einer Sitzung.
 *   Die Files API ist eine Schleuse, kein Ablageort.
 *
 * Kein Agent spricht direkt mit Supabase. Vor der Sitzung projiziert dieses
 * Modul die nötigen Daten in den Wissensspeicher; nach der Sitzung holt es
 * Ergebnisse und Lieferungen zurück. Damit entfällt der Umweg über
 * `/mnt/session/uploads/` und die Files API vollständig — bis auf das PDF,
 * das binär ist und deshalb nicht in einen Speicher passt.
 *
 * ── Warum Memory und nicht weiter Datei-Uploads ───────────────────────────────
 *
 * Ein Upload lebt genau eine Sitzung und liegt danach account-global in der
 * Files-Liste herum, ohne Mandantenbezug. Ein Memory-Store ist
 * workspace-gebunden, versioniert (jede Änderung erzeugt eine memory_version
 * mit Urheber und Zeitstempel) und überlebt die Sitzung. Für Wissen, das
 * mehrere Läufe überdauert, ist das der richtige Ort.
 *
 * ── Grenzen, die den Entwurf bestimmen ────────────────────────────────────────
 *
 *   100 KB je Memory     Wird `wissensbasis.json` grösser, muss sie in
 *                        wissensbasis/<key>.json aufgeteilt werden. Die
 *                        Agenten-Prompts können beide Formen lesen.
 *   nur Text             PDFs, Bilder, Videos gehen über Files → Storage.
 *   8 Speicher/Sitzung   Wir brauchen zwei.
 *   keine Secrets        Memories werden in jede spätere Sitzung zurück-
 *                        gespielt. Schlüssel gehören in den Vault.
 */

import { getSupabaseAdmin } from "@/lib/platform/supabase";

/** Anzeigenamen der Speicher. Der Mount-Pfad entsteht aus dem Namen:
 *  /mnt/memory/<name>/ — die Agenten-Prompts nennen ihn wörtlich. */
export const WISSENSSPEICHER = "kana-wissen";
export const ERGEBNISSPEICHER = "kana-ergebnisse";

/** Bucket für Lieferungen an den Kunden (PDFs). Muss in Supabase existieren. */
const LIEFERBUCKET = "lieferungen";

/** Zwischen `session.status_idle` und dem Auftauchen der Ausgabedateien in
 *  `files.list` liegen ein bis drei Sekunden Indexierung. */
const INDEXIERUNG_MS = 1500;
const INDEXIERUNG_VERSUCHE = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Beta = any;

const schlafen = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// Hinein — Supabase nach Memory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schreibt einen Memory-Eintrag, egal ob er schon existiert.
 *
 * Die API trennt create und update: `create` auf einen belegten Pfad gibt 409
 * mit `conflicting_memory_id`. Wir fangen das ab und aktualisieren stattdessen.
 * Ein Vorab-`list` wäre ein zusätzlicher Aufruf für den seltenen Erstfall.
 */
async function memorySchreiben(
  beta: Beta,
  storeId: string,
  pfad: string,
  inhalt: string
): Promise<void> {
  const groesse = Buffer.byteLength(inhalt, "utf8");
  if (groesse > 100_000) {
    throw new Error(
      `${pfad} ist ${groesse} Bytes gross, erlaubt sind 100.000. ` +
        `Auf mehrere Eintraege aufteilen (siehe docs/speicherorte.md).`
    );
  }

  try {
    await beta.memoryStores.memories.create(storeId, { path: pfad, content: inhalt });
  } catch (fehler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fehler as any;
    const id = f?.error?.error?.conflicting_memory_id ?? f?.error?.conflicting_memory_id;
    if (f?.status !== 409 || !id) throw fehler;
    await beta.memoryStores.memories.update(storeId, id, { content: inhalt });
  }
}

/**
 * Legt das Markenwissen und die offenen Breakdowns in den Wissensspeicher.
 *
 * Wird vor `sessions.create` aufgerufen. Schlägt die Projektion fehl, ist das
 * kein Grund den Lauf abzubrechen — der Agent meldet selbst, wenn ihm eine
 * Datei fehlt, und diese Meldung ist für den Nutzer verständlicher als ein
 * 500er aus dem Backend.
 */
export async function wissenProjizieren(
  beta: Beta,
  wissensStoreId: string,
  kontext: Record<string, unknown> = {}
): Promise<{ geschrieben: string[]; fehler: string[] }> {
  const db = getSupabaseAdmin();
  const geschrieben: string[] = [];
  const fehler: string[] = [];

  // Markenwissen: die zwölf erlaubten Schlüssel, so wie der Agent sie erwartet.
  try {
    const { data, error } = await db
      .from("brand_knowledge")
      .select("key,title,content,updated_at")
      .order("key");
    if (error) throw new Error(error.message);

    // Leeres Ergebnis ueberschreibt NICHTS. Eine leere Tabelle ist kein Grund,
    // vorhandene Speicherdaten zu loeschen — der haeufigere Fall ist ein
    // Konfigurationsfehler (falsches Projekt, fehlende Rechte), und dann waere
    // der Schaden angerichtet, bevor jemand es merkt.
    if (!data?.length) {
      fehler.push("wissensbasis.json: brand_knowledge ist leer — Speicher bleibt unveraendert");
    } else {
      await memorySchreiben(
        beta,
        wissensStoreId,
        "/wissensbasis.json",
        JSON.stringify(data, null, 2)
      );
      geschrieben.push(`wissensbasis.json (${data.length} Eintraege)`);
    }
  } catch (e) {
    fehler.push(`wissensbasis.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Breakdowns: die freigegebenen, zu denen es noch kein Ergebnis gibt.
  //
  // ad_research hat bewusst KEINE Spalte "analysiert" — der vorhandene Eintrag
  // in analyst_results ist die Markierung. Das ist idempotent: ein zweiter Lauf
  // legt dieselbe Ad nicht erneut vor, ohne dass irgendwo ein Flag verwaltet
  // werden muss, das mit der Wirklichkeit auseinanderlaeuft.
  //
  // Der Agent bekommt `status` mit, damit er "keine" von "alle schon erledigt"
  // unterscheiden kann — das steht so in seinem Prompt, Schritt 3.
  try {
    const { data, error } = await db
      .from("ad_research")
      .select("*")
      .eq("bereit_fuer_analyst", true);
    if (error) throw new Error(error.message);

    const { data: fertig, error: fehlerFertig } = await db
      .from("analyst_results")
      .select("ad_id");
    if (fehlerFertig) throw new Error(fehlerFertig.message);

    const erledigt = new Set((fertig ?? []).map((z) => String(z.ad_id)));
    const freigegeben = data ?? [];
    const ads = freigegeben.filter((a) => !erledigt.has(String(a.ad_id)));

    const status =
      ads.length > 0 ? "offen" : freigegeben.length > 0 ? "alle_analysiert" : "keine";
    await memorySchreiben(
      beta,
      wissensStoreId,
      "/breakdowns.json",
      JSON.stringify({ status, hinweis: null, ads }, null, 2)
    );
    geschrieben.push(`breakdowns.json (${ads.length} von ${freigegeben.length} offen, status ${status})`);
  } catch (e) {
    fehler.push(`breakdowns.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Auftrag des Creative Researchers. Die Feldnamen sind NICHT frei gewaehlt:
  // werkzeuge/filter.js und apify-suche.sh lesen sie genau so. Wer hier
  // umbenennt, muss beide Skripte mit umbenennen.
  try {
    await memorySchreiben(
      beta,
      wissensStoreId,
      "/auftrag.json",
      JSON.stringify(
        {
          targetProduct: kontext.targetProduct ?? null,
          adCount: kontext.adCount ?? null,
          adType: kontext.adType ?? null,
          minImpressions: kontext.minImpressions ?? 0,
          maxVideoDuration: kontext.maxVideoDuration ?? 0,
          startDateMin: kontext.startDateMin ?? null,
          startDateMax: kontext.startDateMax ?? null,
          country: kontext.country ?? "DE",
        },
        null,
        2
      )
    );
    geschrieben.push("auftrag.json");
  } catch (e) {
    fehler.push(`auftrag.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Bereits verarbeitete Ad-IDs. Der Researcher ueberspringt sie, statt
  // Dubletten zu sammeln.
  try {
    const { data, error } = await db.from("ad_research").select("ad_id");
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((z) => String(z.ad_id));
    await memorySchreiben(beta, wissensStoreId, "/bekannte-ads.json", JSON.stringify(ids));
    geschrieben.push(`bekannte-ads.json (${ids.length})`);
  } catch (e) {
    fehler.push(`bekannte-ads.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (fehler.length) console.warn("[speicherProjektion] hinein:", fehler.join(" | "));
  console.log(`[speicherProjektion] hinein: ${geschrieben.join(", ") || "nichts"}`);
  return { geschrieben, fehler };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Heraus — Memory nach Supabase
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Holt die Analysedateien aus dem Ergebnisspeicher nach analyst_results.
 *
 * Der Analyst schreibt eine Datei je Ad unter /analysen/<ad_id>.json. Wir
 * lesen sie, schreiben sie in die Datenbank und markieren die zugehörige Ad
 * in ad_research als analysiert — sonst bekäme sie der Analyst beim nächsten
 * Lauf erneut vorgelegt.
 */
export async function analysenUebernehmen(
  beta: Beta,
  ergebnisStoreId: string
): Promise<number> {
  const db = getSupabaseAdmin();
  let uebernommen = 0;

  let eintraege: Array<{ id: string; path: string }> = [];
  try {
    const liste = await beta.memoryStores.memories.list(ergebnisStoreId, {
      path_prefix: "/analysen/",
      view: "basic",
    });
    eintraege = (liste?.data ?? []).filter(
      (m: { path?: string }) => typeof m.path === "string" && m.path.endsWith(".json")
    );
  } catch (e) {
    console.warn("[speicherProjektion] analysen nicht lesbar:", e instanceof Error ? e.message : e);
    return 0;
  }

  for (const eintrag of eintraege) {
    try {
      const voll = await beta.memoryStores.memories.retrieve(ergebnisStoreId, eintrag.id);
      const analyse = JSON.parse(voll.content);

      // Pflichtfelder wie im Prompt des Analysten. Fehlt eines, ist die Datei
      // unbrauchbar — lieber überspringen als halb speichern.
      if (!analyse.ad_id || !analyse.content) {
        console.warn(`[speicherProjektion] ${eintrag.path}: ad_id oder content fehlt`);
        continue;
      }

      const { error } = await db.from("analyst_results").upsert(
        {
          ad_id: String(analyse.ad_id),
          advertiser: analyse.advertiser ?? "Unbekannt",
          score: Number(analyse.score ?? 0),
          klasse: analyse.klasse ?? "Unbekannt",
          content: String(analyse.content),
        },
        { onConflict: "ad_id" }
      );
      if (error) throw new Error(error.message);

      // Kein Statusfeld zuruecksetzen: der Eintrag in analyst_results IST die
      // Markierung. Siehe wissenProjizieren().
      uebernommen += 1;
    } catch (e) {
      console.warn(
        `[speicherProjektion] ${eintrag.path} nicht uebernommen:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log(`[speicherProjektion] heraus: ${uebernommen}/${eintraege.length} Analysen`);
  return uebernommen;
}

/**
 * Holt Markenwissen aus dem Ergebnisspeicher nach brand_knowledge.
 *
 * Der Brand Expert schreibt eine Datei je Schluessel unter /wissen/<key>.json.
 * Nur die zwoelf erlaubten Schluessel werden uebernommen — alles andere ist ein
 * Tippfehler des Agenten und hat in der Tabelle nichts verloren.
 */
const ERLAUBTE_KEYS = new Set([
  "overview", "brand_identity", "brand_visual", "brand_products",
  "brand_audience", "brand_social", "brand_website", "brand_campaigns",
  "brand_competitors", "brand_strategy", "brand_claims", "brand_content_bank",
]);

export async function wissenUebernehmen(
  beta: Beta,
  ergebnisStoreId: string
): Promise<number> {
  const db = getSupabaseAdmin();
  let uebernommen = 0;

  let eintraege: Array<{ id: string; path: string }> = [];
  try {
    const liste = await beta.memoryStores.memories.list(ergebnisStoreId, {
      path_prefix: "/wissen/",
      view: "basic",
    });
    eintraege = (liste?.data ?? []).filter(
      (m: { path?: string }) => typeof m.path === "string" && m.path.endsWith(".json")
    );
  } catch (e) {
    console.warn("[speicherProjektion] wissen nicht lesbar:", e instanceof Error ? e.message : e);
    return 0;
  }

  for (const eintrag of eintraege) {
    try {
      const voll = await beta.memoryStores.memories.retrieve(ergebnisStoreId, eintrag.id);
      const satz = JSON.parse(voll.content);
      const key = String(satz.key ?? "");

      if (!ERLAUBTE_KEYS.has(key)) {
        console.warn(`[speicherProjektion] ${eintrag.path}: "${key}" ist kein erlaubter Schluessel`);
        continue;
      }
      if (!satz.content) {
        console.warn(`[speicherProjektion] ${eintrag.path}: content fehlt`);
        continue;
      }

      const { error } = await db.from("brand_knowledge").upsert(
        {
          key,
          title: satz.title ?? key,
          content: String(satz.content),
          updated_at: satz.updated_at ?? new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) throw new Error(error.message);
      uebernommen += 1;
    } catch (e) {
      console.warn(
        `[speicherProjektion] ${eintrag.path} nicht uebernommen:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log(`[speicherProjektion] heraus: ${uebernommen}/${eintraege.length} Wissenseintraege`);
  return uebernommen;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Heraus — Files nach Supabase Storage
// ═══════════════════════════════════════════════════════════════════════════════

export type Lieferung = {
  dateiname: string;
  pfad: string;
  bytes: number;
  /** Zeitlich begrenzter Link fuer das Chatfenster. Der Bucket ist privat —
   *  ohne signierte URL kaeme der Browser nicht an die Datei. */
  url: string | null;
};

/** Gueltigkeit der Downloadlinks. Eine Stunde reicht fuer die Sitzung; wer
 *  spaeter noch einmal laden will, holt sich ueber das Portal einen neuen. */
const LINK_GUELTIG_S = 3600;

/**
 * Holt alles ab, was der Agent nach /mnt/session/outputs/ geschrieben hat.
 *
 * Diese Dateien fängt die Files API automatisch ein — kein Upload nötig. Sie
 * sind über `scope_id = session.id` auffindbar. Wir laden sie herunter, legen
 * sie mandantengetrennt in Supabase Storage ab und leeren die Schleuse wieder:
 * ohne `scope_id`-Filter sieht man in der Console sonst alle Dateien aller
 * Kunden nebeneinander.
 *
 * Zwei Fallstricke, beide hier behandelt:
 *   - Die SDK-Files-Ressource setzt nur den files-api-Beta-Header selbst. Ohne
 *     managed-agents-2026-04-01 wird `scope_id` als unbekanntes Feld abgelehnt.
 *   - Zwischen `idle` und dem Erscheinen liegt eine kurze Indexierung. Einmal
 *     leer heisst nicht "keine Datei".
 */
export async function lieferungenUebernehmen(
  beta: Beta,
  sessionId: string,
  organizationId: string,
  runId: string
): Promise<Lieferung[]> {
  const db = getSupabaseAdmin();
  const lieferungen: Lieferung[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dateien: any[] = [];
  for (let versuch = 1; versuch <= INDEXIERUNG_VERSUCHE; versuch++) {
    await schlafen(INDEXIERUNG_MS);
    try {
      const seite = await beta.files.list({
        scope_id: sessionId,
        betas: ["managed-agents-2026-04-01"],
      });
      dateien = seite?.data ?? [];
      if (dateien.length) break;
    } catch (e) {
      console.warn(
        `[speicherProjektion] files.list Versuch ${versuch}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (!dateien.length) {
    console.log("[speicherProjektion] keine Sitzungsausgaben");
    return [];
  }

  for (const datei of dateien) {
    try {
      const antwort = await beta.files.download(datei.id);
      const inhalt = Buffer.from(await antwort.arrayBuffer());
      const pfad = `${organizationId}/${runId}/${datei.filename}`;

      const { error } = await db.storage.from(LIEFERBUCKET).upload(pfad, inhalt, {
        contentType: datei.mime_type ?? "application/octet-stream",
        upsert: true,
      });
      if (error) throw new Error(error.message);

      const { data: signiert } = await db.storage
        .from(LIEFERBUCKET)
        .createSignedUrl(pfad, LINK_GUELTIG_S);

      lieferungen.push({
        dateiname: datei.filename,
        pfad,
        bytes: inhalt.byteLength,
        url: signiert?.signedUrl ?? null,
      });

      // Schleuse leeren. Erst nach erfolgreichem Upload — sonst ist die Datei
      // weg und nirgends angekommen.
      await beta.files.delete(datei.id);
    } catch (e) {
      console.warn(
        `[speicherProjektion] ${datei.filename} nicht uebernommen:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log(
    `[speicherProjektion] Lieferungen: ${lieferungen.map((l) => l.dateiname).join(", ") || "keine"}`
  );
  return lieferungen;
}
