import type { DBAgent } from "@/lib/platform/supabase";

/* Die vier Abteilungen des Relaunch-Entwurfs.
   Die Winkel sind gesetzt und gelten fuer jedes Orbital:
   Marketing oben, Vertrieb rechts, IT unten, Content links.

   Die Datenbank kennt heute andere Kategorien (marketing, sales,
   procurement, operations, research). Die Zuordnung unten bildet sie
   auf die vier Abteilungen ab. Wer eine neue Kategorie anlegt, traegt
   sie hier ein — sonst landet der Agent unter Marketing. */

export const ABTEILUNGEN = [
  { id: "marketing", name: "Marketing", line: "Markt, Creatives, Kampagnen",      angle: -90 },
  { id: "vertrieb",  name: "Vertrieb",  line: "Leads, Angebote, Nachfassen",      angle: 0 },
  { id: "it",        name: "IT",        line: "Betrieb, Tickets, Doku",           angle: 90 },
  { id: "content",   name: "Content",   line: "Planung, Texte, Wiederverwertung", angle: 180 },
] as const;

export type AbteilungId = (typeof ABTEILUNGEN)[number]["id"];

export function abteilungVon(agent: DBAgent): AbteilungId {
  const s = `${agent.category ?? ""} ${agent.name}`.toLowerCase();

  if (/\b(sales|vertrieb|lead|crm|angebot|follow|akquise|cold)\b/.test(s)) return "vertrieb";
  if (/\b(operations|ops|it|procurement|einkauf|monitoring|ticket|support|doku)\b/.test(s)) return "it";
  if (/\b(content|redaktion|text|writing|seo|repurpos|blog|newsletter)\b/.test(s)) return "content";
  return "marketing";
}

/** Agenten nach Abteilung buendeln. Alle vier Abteilungen kommen immer
    zurueck — auch leere, denn das Orbital zeigt den ganzen Aufbau. */
export function nachAbteilung(agents: DBAgent[]) {
  return ABTEILUNGEN.map((a) => ({
    ...a,
    agents: agents.filter((ag) => abteilungVon(ag) === a.id),
  }));
}

export function preisText(agent: DBAgent): string {
  if (!agent.price_eur) return "auf Anfrage";
  return `${agent.price_eur} €/Mon.`;
}
