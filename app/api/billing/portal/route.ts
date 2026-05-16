import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/billing/portal
 *
 * Erstellt eine Stripe Billing Portal Session.
 * Kunden können damit Abo, Zahlungsmethode und Rechnungen selbst verwalten.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ error: "E-Mail nicht gefunden" }, { status: 400 });

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json({ error: "Kein Stripe-Konto gefunden" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://kanaai-49uy.vercel.app";

    const session = await stripe.billingPortal.sessions.create({
      customer:   customers.data[0].id,
      return_url: `${baseUrl}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Billing Portal Fehler:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
