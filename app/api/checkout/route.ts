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
      // Die Metadaten oben haengen NUR an der Checkout-Session. Das Ereignis
      // customer.subscription.deleted liefert aber das Abo-Objekt, nicht die
      // Session — ohne die Wiederholung hier kaeme die Kuendigung ohne jeden
      // Bezug zu Nutzer und Agent an, und der Zugang liesse sich nicht entziehen.
      subscription_data: {
        metadata: {
          clerk_user_id:      userId,
          anthropic_agent_id: anthropicAgentId,
        },
      },
      // Nach erfolgreicher Zahlung → Dashboard mit Erfolgsmeldung
      success_url: `${baseUrl}/dashboard?purchased=${agent.slug}`,
      cancel_url:  `${baseUrl}/dashboard`,
      allow_promotion_codes: true,

      // ── Firmendaten erheben — hier und nirgends sonst ──────────────────────
      //
      // Entscheidung vom 18.08.2026: Die Anmeldung bleibt bei E-Mail und
      // Passwort. Wer sich nur umsehen will, soll kein Formular ausfuellen.
      // Erhoben wird beim KAUF, auf der Stripe-Seite, auf der der Kunde
      // ohnehin gerade eine Rechnungsadresse eintippt.
      //
      // Kein eigenes Formular davor: Jede Seite zwischen "kaufen" und
      // "bezahlt" kostet Abschluesse. Und Stripe kann das besser — die
      // Umsatzsteuer-ID wird dort gleich geprueft, die Adressfelder passen
      // sich dem Land an.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      phone_number_collection: { enabled: true },

      // Drei Felder sind das Maximum bei Stripe. Deshalb nur das, was Stripe
      // NICHT ohnehin liefert:
      //   - Firmenname: Der Rechnungsname ist bei Einzelunternehmern der
      //     Personenname. Fuer die Anrede und den Workspace-Namen brauchen
      //     wir die Firma.
      //   - Website: Die Domain ist der Einstieg ins Firmenwissen und beim
      //     Widget spaeter der Shop.
      //   - Startpunkt: Gibt dem Onboarding eine Richtung, statt bei null
      //     anzufangen. Freiwillig.
      custom_fields: [
        {
          key: "firma",
          label: { type: "custom", custom: "Firmenname" },
          type: "text",
          text: { maximum_length: 100 },
        },
        {
          key: "website",
          label: { type: "custom", custom: "Website oder Shop-Adresse" },
          type: "text",
          optional: true,
          text: { maximum_length: 200 },
        },
        {
          key: "startpunkt",
          label: { type: "custom", custom: "Womit sollen wir starten?" },
          type: "text",
          optional: true,
          text: { maximum_length: 255 },
        },
      ],

      custom_text: {
        submit: {
          message:
            "Nach dem Kauf richten wir Ihren eigenen Arbeitsbereich ein. " +
            "Wir melden uns innerhalb eines Werktags bei Ihnen.",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Stripe Checkout Fehler:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
