// ─── Eure Agent-Definitionen ──────────────────────────────────────────────────
// Hier tragt ihr eure Anthropic Managed Agent IDs ein.
// IDs findet ihr in der Claude Console:
//   platform.claude.com → Managed Agents → Euer Agent → Details
// Das aktuelle Format ist `agent_…` (das ältere `agt_…` ist obsolet).

export type AgentDefinition = {
  id: string;            // Anthropic agent_id aus der Console (agent_…)
  name: string;          // Anzeigename für Kunden
  description: string;   // Kurzbeschreibung
  icon: string;          // Emoji oder Icon-Name
  stripeProductId: string; // Stripe Product ID für diesen Agent
};

// ── HIER EURE AGENTS EINTRAGEN ────────────────────────────────────────────────
// Wichtig: Einträge mit Platzhalter-IDs (Strings, die "PLACEHOLDER" enthalten)
// werden von getEnabledAgents() automatisch ausgefiltert. So können wir live
// gehen, ohne dass im Dashboard kaputte Karten landen.
export const AGENTS: AgentDefinition[] = [
  {
    id: "PLACEHOLDER_SALES",
    name: "Sales Agent",
    description: "Analysiert Verkaufsdaten, erstellt Reports und gibt Handlungsempfehlungen.",
    icon: "📊",
    stripeProductId: "PLACEHOLDER_PROD_SALES",
  },
  {
    id: "PLACEHOLDER_SUPPORT",
    name: "Support Agent",
    description: "Beantwortet Kundenfragen und löst Support-Tickets automatisch.",
    icon: "🎧",
    stripeProductId: "PLACEHOLDER_PROD_SUPPORT",
  },
  {
    id: "agent_01G2ceoKDK99wXmYwBa6gVFQ", // ← Echter Research-Agent
    name: "Research Agent",
    description: "Recherchiert Themen, fasst Ergebnisse zusammen und erstellt Berichte.",
    icon: "🔬",
    stripeProductId: "PLACEHOLDER_PROD_RESEARCH",
  },
];

// Hilfsfunktion: Agent per ID finden
export function getAgentById(agentId: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === agentId);
}

// Hilfsfunktion: Agent per Stripe Product ID finden (für Webhook)
export function getAgentByStripeProductId(
  productId: string
): AgentDefinition | undefined {
  if (productId.startsWith("PLACEHOLDER")) return undefined;
  return AGENTS.find((a) => a.stripeProductId === productId);
}

// Nur Agents zurückgeben, deren IDs echt sind (keine Platzhalter)
export function getEnabledAgents(): AgentDefinition[] {
  return AGENTS.filter(
    (a) => !a.id.startsWith("PLACEHOLDER") && !a.stripeProductId.startsWith("PLACEHOLDER")
  );
}
