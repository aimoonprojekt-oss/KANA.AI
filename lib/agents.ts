// ─── Eure Agent-Definitionen ──────────────────────────────────────────────────
// Hier tragt ihr eure Anthropic Managed Agent IDs ein.
// Diese IDs findet ihr in der Claude Console unter:
// platform.claude.com → Managed Agents → Euer Agent → Details

export type AgentDefinition = {
  id: string;           // Anthropic agent_id aus der Console
  name: string;         // Anzeigename für Kunden
  description: string;  // Kurzbeschreibung
  icon: string;         // Emoji oder Icon-Name
  stripeProductId: string; // Stripe Product ID für diesen Agent
};

// ── HIER EURE AGENTS EINTRAGEN ────────────────────────────────────────────────
export const AGENTS: AgentDefinition[] = [
  {
    id: "agt_DEIN_AGENT_ID_1",           // ← Aus Claude Console kopieren
    name: "Sales Agent",
    description: "Analysiert Verkaufsdaten, erstellt Reports und gibt Handlungsempfehlungen.",
    icon: "📊",
    stripeProductId: "prod_STRIPE_ID_1", // ← Aus Stripe Dashboard kopieren
  },
  {
    id: "agt_DEIN_AGENT_ID_2",           // ← Aus Claude Console kopieren
    name: "Support Agent",
    description: "Beantwortet Kundenfragen und löst Support-Tickets automatisch.",
    icon: "🎧",
    stripeProductId: "prod_STRIPE_ID_2",
  },
  {
    id: "agent_01G2ceoKDK99wXmYwBa6gVFQ",           // ← Aus Claude Console kopieren
    name: "Research Agent",
    description: "Recherchiert Themen, fasst Ergebnisse zusammen und erstellt Berichte.",
    icon: "🔬",
    stripeProductId: "prod_STRIPE_ID_3",
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
  return AGENTS.find((a) => a.stripeProductId === productId);
}
