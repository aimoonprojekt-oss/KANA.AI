import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import Anthropic from "@anthropic-ai/sdk";
import { grantAgentAccess, getDBAgentById } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/webhooks/stripe
 *
 * Verarbeitet Stripe Webhooks nach einem Kauf.
 *
 * Ablauf nach erfolgreicher Zahlung:
 * 1. Liest clerk_user_id + anthropic_agent_id aus den Session-Metadata
 * 2. Lädt den Master-Agent aus Anthropic Console
 * 3. Erstellt eine personalisierte Kopie des Agents für den Kunden
 * 4. Schaltet den Zugang in Supabase frei (agent_access1)
 *
 * Jeder Kunde bekommt seine eigene Agent-ID → Kosten sind in der
 * Anthropic Console pro Agent-ID nachvollziehbar.
 */
export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  // ── Webhook-Signatur verifizieren ─────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe Signatur ungültig:", err);
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  // ── Erfolgreiche Zahlung ──────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId           = session.metadata?.clerk_user_id;
    const masterAgentId    = session.metadata?.anthropic_agent_id;
    const agentName        = session.metadata?.agent_name ?? "Agent";

    if (!userId || !masterAgentId) {
      console.error("Webhook: clerk_user_id oder anthropic_agent_id fehlt in Metadata");
      return NextResponse.json({ received: true });
    }

    console.log(`Kauf: User ${userId} → Agent ${agentName} (${masterAgentId})`);

    try {
      // ── Master-Agent aus DB laden ───────────────────────────────────────
      const masterDBAgent = await getDBAgentById(masterAgentId);
      if (!masterDBAgent) {
        console.error(`Master-Agent nicht in DB: ${masterAgentId}`);
        return NextResponse.json({ received: true });
      }

      // ── Kundenkopie via Anthropic API erstellen ─────────────────────────
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beta = (anthropic as any).beta;

      // Master-Config laden
      const masterConfig = await beta.agents.retrieve(masterAgentId);

      // Eindeutiger Name für die Kundenkopie
      const customerAgentName = `${masterDBAgent.name} — ${userId.slice(0, 12)}`;

      // Kopie erstellen — identische Config, eigene ID
      const customerAgent = await beta.agents.create({
        name:        customerAgentName,
        model:       masterConfig.model,
        description: masterConfig.description ?? "",
        system:      masterConfig.system ?? "",
        tools:       masterConfig.tools ?? [],
        skills:      masterConfig.skills ?? [],
        mcp_servers: masterConfig.mcp_servers ?? [],
      });

      console.log(`✅ Kundenkopie erstellt: ${customerAgent.id} für User ${userId}`);

      // ── Zugang in Supabase freischalten ────────────────────────────────
      await grantAgentAccess(userId, masterAgentId, customerAgent.id);

      console.log(`✅ Zugang freigeschaltet: ${userId} → ${customerAgent.id}`);

    } catch (error) {
      console.error("Fehler bei Agent-Kopie oder Zugangsvergabe:", error);
      // Trotzdem 200 zurückgeben damit Stripe nicht erneut versucht
      // (Fehler manuell über Vercel Logs nachverfolgen)
    }
  }

  // ── Abo-Kündigung ─────────────────────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    // TODO: Zugang widerrufen (active = false in agent_access1)
    console.log("Abo gekündigt — Zugang manuell prüfen");
  }

  return NextResponse.json({ received: true });
}
