import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { grantAgentAccess } from "@/lib/supabase";
import { getAgentByStripeProductId } from "@/lib/agents";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe schickt diesen Webhook nach jedem erfolgreichen Kauf
// Hier schalten wir den Agent-Zugang für den Kunden frei
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  // ── 1. Webhook-Signatur verifizieren (Sicherheit!) ─────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe Webhook Signatur ungültig:", err);
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  // ── 2. Erfolgreiche Zahlung verarbeiten ─────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Clerk User ID aus den Metadata lesen
    // (Müsst ihr beim Erstellen des Stripe Checkout-Links eintragen)
    const userId = session.metadata?.clerk_user_id;

    if (!userId) {
      console.error("Keine clerk_user_id in Stripe Metadata");
      return NextResponse.json({ received: true });
    }

    // Alle gekauften Items durchgehen
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ["data.price.product"],
    });

    for (const item of lineItems.data) {
      const product = item.price?.product as Stripe.Product;
      const productId = product?.id;

      if (!productId) continue;

      // Passenden Agent anhand der Stripe Product ID finden
      const agent = getAgentByStripeProductId(productId);

      if (agent) {
        // ✅ Zugang in der Datenbank freischalten (agent_access1 via organization)
        await grantAgentAccess(userId, agent.id, agent.name, agent.description);
        console.log(`✅ Agent-Zugang freigeschaltet: ${userId} → ${agent.name}`);
      }
    }
  }

  // ── 3. Abo-Kündigung verarbeiten (optional) ─────────────────
  if (event.type === "customer.subscription.deleted") {
    // Hier könntet ihr den Zugang widerrufen
    // await revokeAgentAccess(userId, agentId);
    console.log("Abo gekündigt — Zugang manuell prüfen");
  }

  return NextResponse.json({ received: true });
}
