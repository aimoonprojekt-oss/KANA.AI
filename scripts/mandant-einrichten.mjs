#!/usr/bin/env node
/**
 * Mandant einrichten
 * ==================
 *
 * Kopiert die neutralen Master-Agenten aus dem KANA-Workspace in den Workspace
 * eines Kunden und legt dort die beiden Speicher an.
 *
 *   node scripts/mandant-einrichten.mjs <marke.json> [--schreiben]
 *
 * Zwei Schluessel muessen gesetzt sein:
 *   ANTHROPIC_API_KEY        Quelle — der KANA-Workspace mit den Mastern
 *   ANTHROPIC_API_KEY_KUNDE  Ziel   — der Workspace des Kunden
 *
 * Der Zielschluessel wird in der Console von Hand erzeugt; per API geht das
 * nicht (siehe scripts/workspace-anlegen.sh).
 *
 * Ohne --schreiben wird nur angezeigt, was passieren wuerde.
 *
 * ── Was kopiert wird ─────────────────────────────────────────────────────────
 *
 * Agenten sind workspace-gebunden: ein Agent aus dem KANA-Workspace laesst sich
 * in der Session eines Kunden nicht starten. Deshalb bekommt jeder Kunde eigene
 * Kopien. Kopiert werden system, model, tools, skills, mcp_servers und — nach
 * dem Umschreiben der IDs — der multiagent-Roster.
 *
 * Die Reihenfolge ist nicht beliebig: Ein Koordinator kann erst angelegt
 * werden, wenn seine Unteragenten im Zielworkspace existieren, denn er
 * referenziert sie ueber ihre ID. Das Skript legt deshalb erst alle
 * Nicht-Koordinatoren an, merkt sich die neuen IDs und setzt sie dann im Roster
 * der Koordinatoren ein.
 *
 * ── Was NICHT kopiert wird ───────────────────────────────────────────────────
 *
 * Vault und Environment. Beide sind workspace-gebunden und enthalten
 * Zugangsdaten bzw. Netzregeln, die der Kunde selbst verantwortet. Sie werden
 * am Ende als Aufgabenliste ausgegeben.
 */

const QUELLE = process.env.ANTHROPIC_API_KEY;
const ZIEL = process.env.ANTHROPIC_API_KEY_KUNDE;
const SCHREIBEN = process.argv.includes("--schreiben");
const MARKE_DATEI = process.argv[2];

if (!MARKE_DATEI || MARKE_DATEI.startsWith("--")) {
  console.error("Aufruf: node scripts/mandant-einrichten.mjs <marke.json> [--schreiben]");
  process.exit(1);
}
if (!QUELLE) { console.error("ANTHROPIC_API_KEY fehlt (Quelle)."); process.exit(1); }
if (!ZIEL && SCHREIBEN) { console.error("ANTHROPIC_API_KEY_KUNDE fehlt (Ziel)."); process.exit(1); }

const { readFileSync } = await import("node:fs");
const marke = JSON.parse(readFileSync(MARKE_DATEI, "utf8"));
for (const feld of ["name", "kuerzel", "domain", "ausschluss", "such_keywords"]) {
  if (!marke[feld]) { console.error(`marke.json: Feld "${feld}" fehlt.`); process.exit(1); }
}

const kopf = (key) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "managed-agents-2026-04-01",
  "content-type": "application/json",
});

const api = async (key, pfad, koerper, methode = "GET") => {
  const a = await fetch(`https://api.anthropic.com${pfad}`, {
    method: methode, headers: kopf(key), body: koerper ? JSON.stringify(koerper) : undefined,
  });
  if (!a.ok) throw new Error(`${methode} ${pfad}: ${a.status} ${await a.text()}`);
  return a.json();
};

console.log(`Mandant: ${marke.name}  (${marke.kuerzel})\n`);

const { data: master } = await api(QUELLE, "/v1/agents?limit=100");
const aktiv = master.filter((a) => !a.archived_at);

// Ein Agent, dessen Prompt noch die Marke kennt, gehoert nicht in den Katalog.
const verdaechtig = aktiv.filter((a) => /Sins|SNL\b|sinsnlashes/i.test(a.system));
if (verdaechtig.length) {
  console.log("WARNUNG — diese Master nennen noch einen Mandanten im Prompt:");
  for (const a of verdaechtig) console.log(`   ${a.name}`);
  console.log("   Erst neutralisieren, sonst wird die Spezialisierung mitkopiert.\n");
}

const worker = aktiv.filter((a) => !a.multiagent?.agents?.length);
const koordinatoren = aktiv.filter((a) => a.multiagent?.agents?.length);

console.log(`Zu kopieren: ${worker.length} Unteragenten, ${koordinatoren.length} Koordinator(en)`);
if (!SCHREIBEN) {
  for (const a of [...worker, ...koordinatoren]) console.log(`   ${a.name}`);
  console.log("\nProbelauf. Mit --schreiben tatsaechlich anlegen.");
  process.exit(0);
}

const neueId = new Map();

// Custom Skills sind workspace-gebunden: eine skill_id aus dem Quellworkspace
// existiert im Ziel nicht und laesst der Agent-Create mit 400 auffliegen. Wir
// bilden sie ueber den Anzeigenamen aufeinander ab. Anthropic-Skills (xlsx,
// pdf, …) sind global und brauchen kein Mapping.
const skillMapping = new Map();
{
  const holen = async (key) => {
    const a = await fetch("https://api.anthropic.com/v1/skills?limit=100", {
      headers: { ...kopf(key), "anthropic-beta": "skills-2025-10-02" },
    });
    if (!a.ok) throw new Error(`GET /v1/skills: ${a.status} ${await a.text()}`);
    return (await a.json()).data ?? [];
  };
  const quelle = await holen(QUELLE);
  const ziel = await holen(ZIEL);
  const zielNachTitel = new Map(ziel.map((s) => [s.display_title, s.id]));
  for (const s of quelle) {
    if (s.source !== "custom") continue;
    const passend = zielNachTitel.get(s.display_title);
    if (passend) {
      skillMapping.set(s.id, passend);
      console.log(`   Skill "${s.display_title}": ${s.id} → ${passend}`);
    } else {
      console.log(`   WARNUNG Skill "${s.display_title}" fehlt im Zielworkspace.`);
      console.log(`      Vorher hochladen, sonst schlaegt der Agent-Create fehl.`);
    }
  }
}

// Bereits vorhandene Kopien finden — das Skript ist damit wiederholbar.
const { data: vorhanden } = await api(ZIEL, "/v1/agents?limit=100");
const zielNachName = new Map(vorhanden.filter((a) => !a.archived_at).map((a) => [a.name, a]));
if (zielNachName.size) console.log(`\n${zielNachName.size} Agent(en) bereits im Ziel — werden aktualisiert.`);

const kopiere = async (a, roster) => {
  const skills = (a.skills ?? []).map((s) =>
    s.type === "custom" && skillMapping.has(s.skill_id)
      ? { ...s, skill_id: skillMapping.get(s.skill_id) }
      : s
  );
  const koerper = {
    name: a.name,
    description: a.description ?? "",
    system: a.system,
    model: a.model,
    tools: a.tools,
    ...(skills.length ? { skills } : {}),
    ...(a.mcp_servers?.length ? { mcp_servers: a.mcp_servers } : {}),
    ...(roster ? { multiagent: roster } : {}),
    metadata: { ...(a.metadata ?? {}), master_agent_id: a.id, mandant: marke.kuerzel },
  };

  const schon = zielNachName.get(a.name);
  const neu = schon
    ? await api(ZIEL, `/v1/agents/${schon.id}`, koerper, "POST")
    : await api(ZIEL, "/v1/agents", koerper, "POST");
  neueId.set(a.id, neu.id);
  console.log(`   ${a.name.padEnd(24)} ${neu.id}  ${schon ? `aktualisiert v${neu.version}` : "neu"}`);
  return neu;
};

console.log("\nUnteragenten:");
for (const a of worker) await kopiere(a, null);

console.log("\nKoordinatoren:");
for (const a of koordinatoren) {
  const roster = {
    type: a.multiagent.type,
    // Blosse IDs — die Plattform loest die Version im Zielworkspace neu auf.
    agents: a.multiagent.agents.map((e) => {
      if (e.type === "self" || e.type === "advisor") return e;
      const ziel = neueId.get(e.id);
      if (!ziel) throw new Error(`Rostereintrag ${e.id} wurde nicht mitkopiert.`);
      return ziel;
    }),
  };
  await kopiere(a, roster);
}

console.log("\nSpeicher:");
const { data: speicherVorhanden } = await api(ZIEL, "/v1/memory_stores");
const speicherNachName = new Map(speicherVorhanden.map((s) => [s.name, s]));
const speicher = async (name, beschreibung) =>
  speicherNachName.get(name) ??
  (await api(ZIEL, "/v1/memory_stores", { name, description: beschreibung }, "POST"));
const wissen = await speicher("kana-wissen",
  "Referenzen, Markenwissen, Breakdowns und Werkzeuge. Nur lesend fuer Agenten.");
const ergebnisse = await speicher("kana-ergebnisse",
  "Ergebnisse der Agenten: Analysen je Ad, fertige Strategy Guides.");
console.log(`   kana-wissen       ${wissen.id}`);
console.log(`   kana-ergebnisse   ${ergebnisse.id}`);

// Memory-Eintraege: create, bei 409 auf update ausweichen.
const memorySchreiben = async (storeId, pfad, inhalt) => {
  const a = await fetch(`https://api.anthropic.com/v1/memory_stores/${storeId}/memories`, {
    method: "POST", headers: kopf(ZIEL), body: JSON.stringify({ path: pfad, content: inhalt }),
  });
  if (a.ok) return "neu";
  const text = await a.text();
  if (a.status !== 409) throw new Error(`POST memories ${pfad}: ${a.status} ${text}`);
  const id = JSON.parse(text)?.error?.conflicting_memory_id;
  if (!id) throw new Error(`409 ohne conflicting_memory_id: ${text}`);
  const b = await fetch(`https://api.anthropic.com/v1/memory_stores/${storeId}/memories/${id}`, {
    method: "PATCH", headers: kopf(ZIEL), body: JSON.stringify({ content: inhalt }),
  });
  if (!b.ok) throw new Error(`PATCH memories ${pfad}: ${b.status} ${await b.text()}`);
  return "ersetzt";
};

const artMarke = await memorySchreiben(wissen.id, "/marke.json", JSON.stringify(marke, null, 2));
console.log(`   marke.json ${artMarke}`);

// Werkzeuge und Referenzen aus dem Quellspeicher uebernehmen — sie sind
// Konfiguration, nicht Kundendaten, und in jedem Workspace gleich.
const quellSpeicher = process.env.ANTHROPIC_WISSENS_STORE_ID;
if (quellSpeicher) {
  const { data: eintraege } = await api(QUELLE, `/v1/memory_stores/${quellSpeicher}/memories?view=basic`);
  for (const e of eintraege) {
    if (!e.path.startsWith("/werkzeuge/") && e.path !== "/referenzen.json") continue;
    const voll = await api(QUELLE, `/v1/memory_stores/${quellSpeicher}/memories/${e.id}`);
    const art = await memorySchreiben(wissen.id, e.path, voll.content);
    console.log(`   ${e.path} ${art}`);
  }
} else {
  console.log("   ANTHROPIC_WISSENS_STORE_ID nicht gesetzt — Werkzeuge nicht uebernommen");
}

console.log(`
Rest von Hand — beides ist workspace-gebunden und nicht kopierbar:

  1. Environment anlegen (type cloud, networking limited), allowed_hosts:
     api.apify.com, generativelanguage.googleapis.com, fbcdn.net,
     ${marke.domain}, www.${marke.domain}
  2. Vault anlegen und die Credentials eintragen:
     APIFY            -> api.apify.com                      Header
     GEMINI_API_KEY   -> generativelanguage.googleapis.com  Header
  3. In Supabase je Agent eine Zeile in "agents" mit master_agent_id,
     environment_id, memory_store_ids und vault_ids.
  4. Vercel: ANTHROPIC_API_KEY_<KUERZEL> hinterlegen.

Danach: node scripts/roster-nachziehen.mjs
`);
