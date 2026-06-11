import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getDBAgentById } from "@/lib/platform/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/checkout
 * Body: { anthropicAgentId: string }
 *
 * Erstellt eine Stripe Checkout Session für einen Agent-Kauf.
 * clerk_user_id + anthropic_agent_id werden als Metadata mitgegeben
 * damit der Webhook nach der Zahlung weiß wer was gekauft hat.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { anthropicAgentId } = await req.json();
  if (!anthropicAgentId) {
    return NextResponse.json({ error: "anthropicAgentId fehlt" }, { status: 400 });
  }

  // Agent aus DB laden
  const agent = await getDBAgentById(anthropicAgentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });
  }
  if (!agent.stripe_price_id) {
    return NextResponse.json(
      { error: `Stripe Price ID für "${agent.name}" nicht konfiguriert. In Supabase → agents → stripe_price_id eintragen.` },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://kanaai-49uy.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: agent.stripe_price_id, quantity: 1 }],
      // Entscheidend: User-ID + Agent-ID in Metadata damit Webhook weiß wer was gekauft hat
      metadata: {
        clerk_user_id:       userId,
        anthropic_agent_id:  anthropicAgentId,
        agent_name:          agent.name,
      },
      // Nach erfolgreicher Zahlung → Dashboard mit Erfolgsmeldung
      success_url: `${baseUrl}/dashboard?purchased=${agent.slug}`,
      cancel_url:  `${baseUrl}/dashboard`,
      // Optional: Kundendaten vorausfüllen wenn vorhanden
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Stripe Checkout Fehler:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
