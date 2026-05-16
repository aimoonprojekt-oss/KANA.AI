import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * GET /api/billing/info
 *
 * Gibt alle aktiven Stripe-Abos des eingeloggten Users zurück.
 * Lookup via E-Mail-Adresse (aus Clerk).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ subscriptions: [] });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ subscriptions: [], notice: "Stripe nicht konfiguriert" });
  }

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return NextResponse.json({ subscriptions: [] });

    const customer = customers.data[0];

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status:   "active",
      expand:   ["data.items.data.price.product"],
    });

    const subs = subscriptions.data.map(sub => {
      const item    = sub.items.data[0];
      const price   = item.price;
      const product = price.product as Stripe.Product;
      return {
        id:                   sub.id,
        status:               sub.status,
        planName:             product.name ?? "KANA AI Plan",
        priceEur:             (price.unit_amount ?? 0) / 100,
        interval:             price.recurring?.interval ?? "month",
        currentPeriodStart:   new Date(sub.current_period_start * 1000).toISOString(),
        currentPeriodEnd:     new Date(sub.current_period_end   * 1000).toISOString(),
        cancelAtPeriodEnd:    sub.cancel_at_period_end,
      };
    });

    return NextResponse.json({ subscriptions: subs });
  } catch (error) {
    console.error("Billing info Fehler:", error);
    return NextResponse.json({ subscriptions: [] });
  }
}
