import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { grantAgentAccess, revokeAgentAccess, getDBAgentById } from "@/lib/platform/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/webhooks/stripe
 *
 * Verarbeitet Stripe Webhooks nach einem Kauf.
 *
 * Ablauf nach erfolgreicher Zahlung:
 * 1. Liest clerk_user_id + anthropic_agent_id aus den Session-Metadata
 * 2. Schaltet den Zugang in Supabase frei (agent_access1)
 *
 * Die Kundenkopie des Agenten entsteht NICHT hier, sondern beim ersten Chat
 * im Workspace des Kunden — siehe lib/anthropic/kundenkopie.ts.
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

      // ── Zugang freischalten. Mehr nicht. ────────────────────────────────
      //
      // Bis 18.08.2026 legte diese Stelle eine Kundenkopie des Agenten an —
      // mit dem KANA-Schluessel, also im KANA-Workspace. In Modell A ist das
      // der falsche Ort: Die Kopie gehoert in den Workspace des Kunden.
      //
      // Sie hier anzulegen ginge auch gar nicht zuverlaessig. Beim Kauf hat
      // der Kunde womoeglich noch keinen Workspace — das Onboarding ist laut
      // scripts/workspace-anlegen.sh teilweise Handarbeit und passiert nicht
      // in den Sekunden, die Stripe auf eine Antwort wartet. Und schlaegt es
      // fehl, ist der Kauf durch und der Zugang kaputt.
      //
      // Die Kopie entsteht deshalb beim ersten Chat, idempotent:
      // lib/anthropic/kundenkopie.ts. Das deckt auch Bestandskunden ab, deren
      // Kauf laengst zurueckliegt.
      await grantAgentAccess(userId, masterAgentId);

      console.log(`Zugang freigeschaltet: ${userId} -> ${masterDBAgent.name}`);

    } catch (error) {
      console.error("Fehler bei der Zugangsvergabe:", error);
      // Trotzdem 200 zurückgeben damit Stripe nicht erneut versucht
      // (Fehler manuell über Vercel Logs nachverfolgen)
    }
  }

  // ── Abo-Kündigung ─────────────────────────────────────────────────────────
  // M1: Hier stand ein TODO. Folge: Wer kuendigte, behielt den Zugang dauerhaft
  // und nutzte weiter Anthropic-Kontingent auf unsere Rechnung.
  if (event.type === "customer.subscription.deleted") {
    const abo = event.data.object as { id?: string; metadata?: Record<string, string> };
    const userId        = abo.metadata?.clerk_user_id;
    const masterAgentId = abo.metadata?.anthropic_agent_id;

    if (!userId) {
      // Kein Metadaten-Bezug: nicht raten, sondern laut scheitern lassen und
      // von Hand nacharbeiten. Ein falsch entzogener Zugang ist schlimmer
      // als ein zu spaet entzogener.
      console.error("Abo gekuendigt, aber keine userId in den Metadaten:", abo.id);
    } else {
      try {
        await revokeAgentAccess(userId, masterAgentId);
        console.log(`Zugang entzogen: ${userId} → ${masterAgentId ?? "alle Agenten"}`);
      } catch (error) {
        console.error("Zugang konnte nicht entzogen werden:", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
