#!/usr/bin/env node
/**
 * Roster nachziehen
 * =================
 *
 * Ein Koordinator verweist auf seine Unteragenten ueber deren ID. Beim
 * Speichern loest die Plattform daraus eine Versionsnummer auf — die API gibt
 * anschliessend `{id, type:"agent", version: N}` zurueck, auch wenn man nur den
 * blossen String geschickt hat.
 *
 * Ob dieser Wert zur Laufzeit als fester Pin wirkt oder nur die zum
 * Speicherzeitpunkt aufgeloeste Version anzeigt, ist aus der Doku nicht
 * eindeutig: die Tabelle in shared/managed-agents-multiagent.md nennt den
 * String "references the latest version", die Zeile darunter sagt "pin the
 * latest at coordinator save time". Beobachtet wurde das Pin-Verhalten — der
 * Roster zeigte nach einem Unteragenten-Update weiterhin die alte Nummer.
 *
 * Dieses Skript macht die Frage gegenstandslos: es speichert jeden Koordinator
 * neu und zwingt damit eine frische Aufloesung. Nach jeder Aenderung an einem
 * Unteragenten aufrufen — oder in die Deploy-Pipeline haengen.
 *
 *   node scripts/roster-nachziehen.mjs            zeigt nur an, was veraltet ist
 *   node scripts/roster-nachziehen.mjs --schreiben zieht nach
 */

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("ANTHROPIC_API_KEY fehlt.");
  process.exit(1);
}

const SCHREIBEN = process.argv.includes("--schreiben");
const KOPF = {
  "x-api-key": KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "managed-agents-2026-04-01",
  "content-type": "application/json",
};

const api = async (pfad, koerper, methode = "GET") => {
  const antwort = await fetch(`https://api.anthropic.com${pfad}`, {
    method: methode,
    headers: KOPF,
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  if (!antwort.ok) throw new Error(`${methode} ${pfad}: ${antwort.status} ${await antwort.text()}`);
  return antwort.json();
};

const { data: agenten } = await api("/v1/agents?limit=100");
const aktuell = new Map(agenten.map((a) => [a.id, { name: a.name, version: a.version }]));

const koordinatoren = agenten.filter((a) => a.multiagent?.agents?.length);
if (!koordinatoren.length) {
  console.log("Kein Koordinator gefunden.");
  process.exit(0);
}

let veraltet = 0;

for (const k of koordinatoren) {
  const zeilen = k.multiagent.agents.map((e) => {
    const ist = aktuell.get(e.id);
    const hinkt = ist && e.version !== undefined && e.version < ist.version;
    if (hinkt) veraltet += 1;
    return {
      name: ist?.name ?? e.id,
      imRoster: e.version ?? "—",
      aktuell: ist?.version ?? "?",
      hinkt,
    };
  });

  console.log(`\n${k.name}  (v${k.version})`);
  for (const z of zeilen) {
    const markierung = z.hinkt ? "  ← veraltet" : "";
    console.log(`   ${z.name.padEnd(24)} Roster v${z.imRoster}   aktuell v${z.aktuell}${markierung}`);
  }

  if (SCHREIBEN && zeilen.some((z) => z.hinkt)) {
    // Blosse IDs schicken — die Plattform loest erneut auf.
    const neu = await api(`/v1/agents/${k.id}`, {
      multiagent: { type: k.multiagent.type, agents: k.multiagent.agents.map((e) => e.id) },
    }, "POST");
    const stand = neu.multiagent.agents
      .map((e) => `${aktuell.get(e.id)?.name ?? e.id} v${e.version}`)
      .join(", ");
    console.log(`   → neu gespeichert als v${neu.version}: ${stand}`);
  }
}

if (!SCHREIBEN && veraltet) {
  console.log(`\n${veraltet} veralteter Rostereintrag. Nachziehen mit --schreiben`);
  process.exit(1);
}
if (!veraltet) console.log("\nAlle Roster aktuell.");
