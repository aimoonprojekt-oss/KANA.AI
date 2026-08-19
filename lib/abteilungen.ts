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

/* ─── Tarife ─────────────────────────────────────────────
   Die Datenbank kennt heute nur einen Preis je Agent (price_eur).
   Ein eigener Buendelpreis fuer eine ganze Abteilung existiert nicht —
   die Abteilungsstufe wird deshalb aus der Summe der Agenten gebildet
   und als "ab" ausgewiesen. Sobald es eine Spalte fuer Buendelpreise
   gibt, gehoert sie hierher.                                      */

export type Tarife = {
  abEinAgent: number | null;
  abAbteilung: number | null;
  /** Abteilung, aus der der Abteilungspreis stammt — fuer die Fussnote */
  abteilungName: string | null;
};

export function tarifeAus(agents: DBAgent[]): Tarife {
  const preise = agents.map((a) => a.price_eur).filter((p) => p > 0);
  const abEinAgent = preise.length > 0 ? Math.min(...preise) : null;

  /* Ein Abteilungspreis ergibt nur Sinn, wenn JEDER Agent der Abteilung
     einen Preis hat. Sonst kaeme eine Summe heraus, die die Agenten ohne
     Preis stillschweigend als kostenlos behandelt — im schlimmsten Fall
     steht dann derselbe Betrag bei "Ein Agent" und bei "Abteilung". */
  const summen = nachAbteilung(agents)
    .map((d) => ({
      name: d.name,
      summe: d.agents.reduce((s, a) => s + (a.price_eur || 0), 0),
      vollstaendig: d.agents.length > 1 && d.agents.every((a) => a.price_eur > 0),
    }))
    .filter((d) => d.vollstaendig)
    .sort((a, b) => a.summe - b.summe);

  return {
    abEinAgent,
    abAbteilung: summen[0]?.summe ?? null,
    abteilungName: summen[0]?.name ?? null,
  };
}

export function eur(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
