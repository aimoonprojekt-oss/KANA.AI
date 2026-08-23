/**
 * Bereitschaftspruefung
 * =====================
 *
 * GET /api/bereitschaft
 *
 * Sagt in einem Aufruf, ob ein Agentenlauf ueberhaupt gelingen kann — und
 * wenn nicht, woran es liegt. Gedacht fuer den Moment vor dem ersten Test und
 * nach jedem Deploy.
 *
 * Der Anlass: Umgebungsvariablen sind von aussen nicht einsehbar. Ob
 * ANTHROPIC_ERGEBNIS_STORE_ID in Vercel gesetzt ist, weiss nur die laufende
 * Anwendung. Frueher merkte man es erst, wenn ein Lauf nach fuenf Minuten mit
 * "Keine Brand Knowledge gefunden" endete — und bezahlt war er trotzdem.
 *
 * Geprueft wird in drei Schichten:
 *
 *   Konfiguration   Welche Umgebungsvariablen sind gesetzt? Nur ja/nein —
 *                   niemals Werte, auch nicht gekuerzt.
 *   Console         Existieren Speicher und Agenten? Liegen die erwarteten
 *                   Dateien im Wissensspeicher? Ist der Ergebnisspeicher
 *                   beschreibbar?
 *   Datenbank       Gibt es Markenwissen und offene Breakdowns, oder laeuft
 *                   der Agent ins Leere?
 *
 * Antwort ist immer 200 mit einem Statusfeld — "bereit", "eingeschraenkt"
 * oder "blockiert". Ein 500er waere hier irrefuehrend: die Pruefung selbst hat
 * ja funktioniert.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/platform/supabase";

export const dynamic = "force-dynamic";

type Befund = {
  bereich: string;
  pruefung: string;
  ergebnis: "ok" | "warnung" | "fehlt";
  hinweis?: string;
};

const gesetzt = (name: string) => (process.env[name] ?? "").length > 0;

export async function GET() {
  const befunde: Befund[] = [];
  const notiere = (bereich: string, pruefung: string,
                   ergebnis: Befund["ergebnis"], hinweis?: string) =>
    befunde.push({ bereich, pruefung, ergebnis, ...(hinweis ? { hinweis } : {}) });

  // ── Konfiguration ──────────────────────────────────────────────────────────
  const pflicht: Array<[string, string]> = [
    ["ANTHROPIC_API_KEY", "Ohne ihn laeuft gar nichts."],
    ["ANTHROPIC_WISSENS_STORE_ID", "Ohne ihn wird nichts projiziert; jeder Agent meldet 'Keine Brand Knowledge gefunden'."],
    ["ANTHROPIC_ERGEBNIS_STORE_ID", "Ohne ihn hat kein Agent Schreibrecht; Analysen und Guides gehen nach der Sitzung verloren."],
    ["NEXT_PUBLIC_SUPABASE_URL", "Datenbank nicht erreichbar."],
    ["SUPABASE_SERVICE_ROLE_KEY", "Backend kann nicht schreiben."],
  ];
  for (const [name, hinweis] of pflicht) {
    notiere("Konfiguration", name, gesetzt(name) ? "ok" : "fehlt", gesetzt(name) ? undefined : hinweis);
  }
  for (const name of ["ANTHROPIC_API_KEY_SNL", "ANTHROPIC_MAX_LIST_COST_CENT"]) {
    notiere("Konfiguration", name, gesetzt(name) ? "ok" : "warnung",
      gesetzt(name) ? undefined
        : name === "ANTHROPIC_MAX_LIST_COST_CENT"
          ? "Nicht gesetzt — es gilt der Default aus route.ts (800 Cent)."
          : "Nicht gesetzt — Kunden ohne eigenen Workspace laufen ueber KANA AI.");
  }

  // ── Console ────────────────────────────────────────────────────────────────
  const schluessel = process.env.ANTHROPIC_API_KEY ?? "";
  const wissenId = process.env.ANTHROPIC_WISSENS_STORE_ID ?? "";
  const ergebnisId = process.env.ANTHROPIC_ERGEBNIS_STORE_ID ?? "";

  const console_api = async (pfad: string) => {
    const a = await fetch(`https://api.anthropic.com${pfad}`, {
      headers: {
        "x-api-key": schluessel,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "managed-agents-2026-04-01",
      },
      cache: "no-store",
    });
    if (!a.ok) throw new Error(`${a.status} ${(await a.text()).slice(0, 160)}`);
    return a.json();
  };

  if (schluessel && wissenId) {
    try {
      const { data } = await console_api(`/v1/memory_stores/${wissenId}/memories?view=basic`);
      const pfade = new Set((data ?? []).map((m: { path: string }) => m.path));
      notiere("Console", "Wissensspeicher erreichbar", "ok", `${pfade.size} Eintraege`);

      // marke.json ist die einzige Stelle, an der der Mandant steht.
      notiere("Console", "marke.json", pfade.has("/marke.json") ? "ok" : "fehlt",
        pfade.has("/marke.json") ? undefined : "Ohne sie stoppt jeder Agent im ersten Schritt.");

      for (const w of ["/werkzeuge/score.js", "/werkzeuge/apify-suche.sh",
                       "/werkzeuge/filter.js", "/werkzeuge/video-analyse.sh"]) {
        notiere("Console", w, pfade.has(w) ? "ok" : "fehlt",
          pfade.has(w) ? undefined : "Werkzeug fehlt — der zugehoerige Agent bricht ab.");
      }
      notiere("Console", "/referenzen.json", pfade.has("/referenzen.json") ? "ok" : "fehlt",
        pfade.has("/referenzen.json") ? undefined : "REF-Dateien fehlen; der Strategist stoppt in Schritt 1.");
    } catch (e) {
      notiere("Console", "Wissensspeicher erreichbar", "fehlt",
        e instanceof Error ? e.message : String(e));
    }
  }

  if (schluessel && ergebnisId) {
    try {
      await console_api(`/v1/memory_stores/${ergebnisId}/memories?view=basic`);
      notiere("Console", "Ergebnisspeicher erreichbar", "ok");
    } catch (e) {
      notiere("Console", "Ergebnisspeicher erreichbar", "fehlt",
        e instanceof Error ? e.message : String(e));
    }
  }

  if (schluessel) {
    try {
      const { data } = await console_api("/v1/agents?limit=100");
      const aktiv = (data ?? []).filter((a: { archived_at: string | null }) => !a.archived_at);
      notiere("Console", "Agenten", aktiv.length ? "ok" : "fehlt", `${aktiv.length} aktiv`);

      // Ein Roster, der hinter seinen Unteragenten herhinkt, ist der Fehler,
      // der am laengsten unbemerkt bleibt — er sieht wie ein Prompt-Problem aus.
      const stand = new Map(aktiv.map((a: { id: string; version: number }) => [a.id, a.version]));
      const hinkende: string[] = [];
      for (const a of aktiv) {
        for (const e of a.multiagent?.agents ?? []) {
          if (e.version !== undefined && stand.has(e.id) && e.version < (stand.get(e.id) as number)) {
            hinkende.push(`${a.name} → ${e.id} v${e.version} statt v${stand.get(e.id)}`);
          }
        }
      }
      notiere("Console", "Roster aktuell", hinkende.length ? "warnung" : "ok",
        hinkende.length ? `${hinkende.join("; ")} — scripts/roster-nachziehen.mjs --schreiben` : undefined);

      // Ein Master, der eine Marke im Prompt nennt, ist nicht mehr neutral.
      const spezialisiert = aktiv
        .filter((a: { system?: string }) => /Sins|SNL\b|sinsnlashes/i.test(a.system ?? ""))
        .map((a: { name: string }) => a.name);
      notiere("Console", "Agenten mandantenneutral", spezialisiert.length ? "warnung" : "ok",
        spezialisiert.length ? `Marke im Prompt: ${spezialisiert.join(", ")}` : undefined);
    } catch (e) {
      notiere("Console", "Agenten", "fehlt", e instanceof Error ? e.message : String(e));
    }
  }

  // ── Datenbank ──────────────────────────────────────────────────────────────
  try {
    const db = getSupabaseAdmin();
    const { count: wissen } = await db.from("brand_knowledge")
      .select("key", { count: "exact", head: true });
    notiere("Datenbank", "brand_knowledge", (wissen ?? 0) > 0 ? "ok" : "warnung",
      `${wissen ?? 0} von 12 Schluesseln` +
      ((wissen ?? 0) < 12 ? " — der Brand Expert fuellt die fehlenden." : ""));

    const { data: offen } = await db.from("ad_research")
      .select("ad_id").eq("bereit_fuer_analyst", true);
    const { data: fertig } = await db.from("analyst_results").select("ad_id");
    const erledigt = new Set((fertig ?? []).map((z) => String(z.ad_id)));
    const zuTun = (offen ?? []).filter((a) => !erledigt.has(String(a.ad_id))).length;
    notiere("Datenbank", "Offene Breakdowns", zuTun > 0 ? "ok" : "warnung",
      zuTun > 0 ? `${zuTun} zur Analyse` : "Keine — der Strategist ueberspringt den Analysten.");

    // Mandantentrennung. Die Katalogabfragen filtern auf published = true,
    // Kopien sind nie published — beides zusammen haelt Kunden auseinander.
    // Hier wird nachgesehen, ob das auch wirklich so im Bestand steht.
    const { data: alleAgenten } = await db
      .from("agents")
      .select("name, workspace, published, master_agent_id, organization_id, archived")
      .eq("archived", false);
    const agenten = alleAgenten ?? [];
    const kopien = agenten.filter((a) => a.master_agent_id);
    const veroeffentlichteKopien = kopien.filter((a) => a.published);
    notiere("Mandantentrennung", "Kopien nicht veroeffentlicht",
      veroeffentlichteKopien.length ? "fehlt" : "ok",
      veroeffentlichteKopien.length
        ? `${veroeffentlichteKopien.length} Kopie(n) stehen im Katalog: ${veroeffentlichteKopien.map((a) => `${a.name} (${a.workspace})`).join(", ")}`
        : `${kopien.length} Kopie(n), alle unveroeffentlicht`);

    // Ein Agent ohne Workspace laesst sich keiner Console zuordnen — und da
    // alle Kopien gleich heissen, ist er in der Oberflaeche nicht auffindbar.
    const ohneWorkspace = agenten.filter((a) => !a.workspace).map((a) => a.name);
    notiere("Mandantentrennung", "Workspace zugeordnet",
      ohneWorkspace.length ? "warnung" : "ok",
      ohneWorkspace.length ? `ohne Workspace: ${ohneWorkspace.join(", ")}` : `${agenten.length} Agenten zugeordnet`);

    const { data: buckets } = await db.storage.listBuckets();
    const lieferungen = (buckets ?? []).find((b) => b.name === "lieferungen");
    notiere("Datenbank", "Storage-Bucket lieferungen", lieferungen ? "ok" : "fehlt",
      lieferungen ? undefined : "Ohne ihn koennen PDFs nicht ausgeliefert werden.");
  } catch (e) {
    notiere("Datenbank", "Erreichbar", "fehlt", e instanceof Error ? e.message : String(e));
  }

  const fehlt = befunde.filter((b) => b.ergebnis === "fehlt").length;
  const warnungen = befunde.filter((b) => b.ergebnis === "warnung").length;

  return NextResponse.json({
    status: fehlt ? "blockiert" : warnungen ? "eingeschraenkt" : "bereit",
    zusammenfassung: `${befunde.length - fehlt - warnungen} ok, ${warnungen} Warnung(en), ${fehlt} fehlend`,
    geprueft_am: new Date().toISOString(),
    befunde,
  });
}
