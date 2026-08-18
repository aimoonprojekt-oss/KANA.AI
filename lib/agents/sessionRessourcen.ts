/**
 * Session-Ressourcen — behebt L2 aus claude/architektur-console-first.md
 * ======================================================================
 *
 * Das Problem, das hier gelöst wird:
 *
 * Die Console-Agenten erwarten ihre Werkzeuge und ihren Auftrag als Dateien
 * unter `/mnt/session/uploads/`. Der Creative Researcher etwa liest
 * `apify-suche.sh`, `filter.js`, `video-analyse.sh`, `auftrag.json` und
 * `bekannte-ads.json` — so steht es in agents/creative-researcher/agent.yaml
 * und in dessen LIESMICH.md.
 *
 * Nur hat diese Dateien nie jemand dorthin gelegt. Commit cb5efa1 hat am
 * 17.08.2026 die *Pfade* in den Prompts von /workspace auf /mnt/session/uploads
 * korrigiert — richtig, aber die Gegenseite wurde nie gebaut. Der Agent startet,
 * sucht, findet nichts und hört auf. Genau das zeigte der Testlauf.
 *
 * ── Wie Dateien in den Container kommen ───────────────────────────────────────
 *
 * Zwei Schritte, beide über die Managed-Agents-API:
 *
 *   1. `beta.files.upload({ file })`  → liefert eine file_id
 *   2. beim Anlegen der Session als Ressource anhängen:
 *      `{ type: "file", file_id, mount_path }`
 *
 * Wichtig: Ohne `mount_path` landet die Datei unter `/mnt/session/uploads/<file_id>`
 * — also unter einem zufälligen Namen, den kein Prompt kennt. Der Mount-Pfad ist
 * deshalb nicht optional, sondern der eigentliche Punkt.
 *
 * ── Zwei Arten von Dateien ────────────────────────────────────────────────────
 *
 *   statisch   Die Werkzeugskripte. Liegen im Repo unter
 *              agents/<slug>/werkzeuge/ und sind für jeden Lauf gleich.
 *              Konvention statt Konfiguration: Was dort liegt, wird gemountet.
 *
 *   dynamisch  Auftrag und Vorwissen. Werden je Lauf erzeugt — aus den
 *              Parametern des Nutzers und aus unserer Datenbank.
 *
 * Die dynamischen Dateien stehen bewusst als Liste im Code, nicht als Konfiguration
 * in der Datenbank — gleiche Begründung wie bei lib/anthropic/workspaces.ts: Ein
 * neuer Agent ist ein Eintrag hier, sichtbar im Pull Request.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { toFile } from "@anthropic-ai/sdk";
import { getSupabaseAdmin, type DBAgent } from "@/lib/platform/supabase";

/** Eine Datei, so wie sie im Container ankommen soll. */
export type Sessiondatei = {
  /** Dateiname im Container, z.B. "auftrag.json". Ohne Pfad. */
  name: string;
  inhalt: string;
};

/** Ressourceneintrag für sessions.create — Form laut SDK-Typ BetaManagedAgentsFileResourceParams. */
export type Dateiressource = {
  type: "file";
  file_id: string;
  mount_path: string;
};

const UPLOAD_VERZEICHNIS = "/mnt/session/uploads";

// ═══════════════════════════════════════════════════════════════════════════════
// Statisch — die Werkzeugskripte aus dem Repo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Liest agents/<slug>/werkzeuge/ und gibt alles zurück, was darin liegt.
 *
 * Existiert der Ordner nicht, ist das kein Fehler — die meisten Agenten haben
 * keine Werkzeuge. Der Support-Agent zum Beispiel redet nur.
 *
 * ACHTUNG Vercel: Damit diese Dateien im Lambda überhaupt vorhanden sind, muss
 * `outputFileTracingIncludes` in next.config.ts sie einschließen. Next.js packt
 * sonst nur ein, was es über Importe erreicht — und ein fs.readFile auf einen
 * zusammengesetzten Pfad erreicht es nicht.
 */
async function werkzeugdateien(ordnerName: string): Promise<Sessiondatei[]> {
  const ordner = path.join(process.cwd(), "agents", ordnerName, "werkzeuge");

  let eintraege: string[];
  try {
    eintraege = await fs.readdir(ordner);
  } catch {
    return [];
  }

  const dateien: Sessiondatei[] = [];
  for (const name of eintraege) {
    // Versteckte Dateien und Unterordner bleiben draussen. Markdown NICHT
    // ausschliessen: agents/dokumentenbauer/werkzeuge/SKILL.md ist eine
    // Skill-Beschreibung, die der Agent im Container lesen soll — keine
    // Dokumentation fuer uns.
    if (name.startsWith(".")) continue;
    const voll = path.join(ordner, name);
    const stat = await fs.stat(voll);
    if (!stat.isFile()) continue;
    dateien.push({ name, inhalt: await fs.readFile(voll, "utf8") });
  }
  return dateien;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dynamisch — Auftrag und Vorwissen, je Lauf neu
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Der Auftrag des Creative Researchers.
 *
 * Die Feldnamen sind NICHT frei gewählt: Sie stehen genau so in
 * agents/creative-researcher/LIESMICH.md und werden von werkzeuge/filter.js
 * gelesen. Wer hier umbenennt, muss filter.js mit umbenennen.
 *
 * Es sind dieselben Parameter, die der alte Pfad (/api/research/run) im
 * Anfragekörper entgegennimmt — der Umbau ändert den Transportweg, nicht die
 * Fachlichkeit.
 */
function researcherAuftrag(kontext: Record<string, unknown>) {
  return {
    targetProduct:    kontext.targetProduct ?? null,
    adCount:          kontext.adCount ?? null,
    adType:           kontext.adType ?? null,
    minImpressions:   kontext.minImpressions ?? 0,
    maxVideoDuration: kontext.maxVideoDuration ?? 0,
    startDateMin:     kontext.startDateMin ?? null,
    startDateMax:     kontext.startDateMax ?? null,
    country:          kontext.country ?? "DE",
  };
}

/**
 * Bereits verarbeitete Ad-IDs. Der Agent überspringt sie, statt Dubletten zu
 * sammeln. Das ist der einzige verbliebene Grund, ad_research zu behalten.
 */
async function bekannteAdIds(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("ad_research")
    .select("ad_id");
  if (error) {
    // Kein Abbruch: Ohne Vorwissen sammelt der Agent womöglich eine Dublette.
    // Das ist ärgerlich, aber kein Grund, den ganzen Lauf zu verweigern.
    console.warn("[sessionRessourcen] ad_research nicht lesbar:", error.message);
    return [];
  }
  return (data ?? []).map((z) => String(z.ad_id));
}

/**
 * Welcher Agent bekommt welche erzeugten Dateien.
 * Schlüssel ist `agents.repo_ordner` — also der Ordnername unter agents/ im Repo.
 */
const DYNAMISCHE_DATEIEN: Record<
  string,
  (kontext: Record<string, unknown>) => Promise<Sessiondatei[]>
> = {
  "creative-researcher": async (kontext) => [
    {
      name: "auftrag.json",
      inhalt: JSON.stringify(researcherAuftrag(kontext), null, 2),
    },
    {
      name: "bekannte-ads.json",
      inhalt: JSON.stringify(await bekannteAdIds()),
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Zusammensetzen und hochladen
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sammelt alle Dateien, die dieser Agent im Container braucht, lädt sie hoch und
 * gibt fertige Ressourceneinträge für `sessions.create` zurück.
 *
 * Braucht der Agent nichts, ist das Ergebnis eine leere Liste — dann verhält
 * sich der Aufruf wie vorher.
 *
 * @param beta  Der `anthropic.beta`-Zweig. Wird hereingereicht statt selbst
 *              erzeugt, damit dieses Modul keinen zweiten Client aufmacht.
 */
export async function sessionDateienAnhaengen(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beta: any,
  agentDef: DBAgent | null,
  kontext: Record<string, unknown> = {}
): Promise<Dateiressource[]> {
  // repo_ordner ist der Schluessel, nicht der Slug — siehe Migration 0004.
  // Ist er nicht gesetzt, hat der Agent keine Werkzeuge, und das ist der
  // Normalfall (Support, Brand Expert, Datenpfleger).
  const ordnerName = agentDef?.repo_ordner;
  if (!ordnerName) return [];

  const bauer = DYNAMISCHE_DATEIEN[ordnerName];
  const [statisch, dynamisch] = await Promise.all([
    werkzeugdateien(ordnerName),
    bauer ? bauer(kontext) : Promise.resolve([]),
  ]);

  const alle = [...statisch, ...dynamisch];
  if (alle.length === 0) return [];

  // Nacheinander statt parallel: Bei einem Fehler soll aus der Meldung
  // hervorgehen, WELCHE Datei es war.
  const ressourcen: Dateiressource[] = [];
  for (const datei of alle) {
    const hochgeladen = await beta.files.upload({
      file: await toFile(Buffer.from(datei.inhalt, "utf8"), datei.name),
    });
    ressourcen.push({
      type: "file",
      file_id: hochgeladen.id,
      // Ohne mount_path hiesse die Datei im Container wie ihre file_id.
      mount_path: `${UPLOAD_VERZEICHNIS}/${datei.name}`,
    });
  }

  console.log(
    `[sessionRessourcen] ${ordnerName}: ${statisch.length} Werkzeug(e), ` +
      `${dynamisch.length} erzeugte Datei(en) → ${alle.map((d) => d.name).join(", ")}`
  );

  return ressourcen;
}
