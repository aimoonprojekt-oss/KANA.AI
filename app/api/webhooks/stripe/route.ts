import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  grantAgentAccess,
  revokeAgentAccess,
  getDBAgentById,
  kundendatenSpeichern,
} from "@/lib/platform/supabase";
import { mailSenden, betriebsAdressen } from "@/lib/platform/mail";

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

      // ── Firmendaten aus dem Checkout uebernehmen ────────────────────────
      // Stripe hat sie gerade erhoben: Rechnungsanschrift, USt-ID, Telefon
      // sowie unsere drei eigenen Felder. Erhoben wird beim Kauf und nicht
      // bei der Anmeldung — wer sich nur umsieht, soll kein Formular sehen.
      const felder = new Map(
        (session.custom_fields ?? []).map((f) => [f.key, f.text?.value ?? f.dropdown?.value ?? null])
      );
      const kunde = session.customer_details;

      await kundendatenSpeichern(userId, {
        firma:              felder.get("firma") ?? kunde?.name ?? null,
        ansprechpartner:    kunde?.name ?? null,
        telefon:            kunde?.phone ?? null,
        website:            felder.get("website") ?? null,
        ust_id:             kunde?.tax_ids?.[0]?.value ?? null,
        rechnungsanschrift: (kunde?.address ?? null) as Record<string, unknown> | null,
        onboarding_notiz:   felder.get("startpunkt") ?? null,
      });

      // ── Betrieb benachrichtigen ────────────────────────────────────────
      // Ein Kauf passiert selten genug, dass er eine Unterbrechung wert ist,
      // und oft genug, dass man ihn nicht uebersehen darf. Deshalb eine Mail
      // und kein Punkt in einer Liste, die niemand oeffnet.
      const empfaenger = betriebsAdressen();
      if (empfaenger.length) {
        await mailSenden({
          an: empfaenger,
          betreff: `Neuer Kunde: ${felder.get("firma") ?? kunde?.name ?? kunde?.email ?? userId}`,
          text: [
            `Neuer Kauf — dieser Kunde braucht einen Workspace.`,
            ``,
            `Agent:        ${masterDBAgent.name}`,
            `Firma:        ${felder.get("firma") ?? "-"}`,
            `Ansprechpartner: ${kunde?.name ?? "-"}`,
            `E-Mail:       ${kunde?.email ?? "-"}`,
            `Telefon:      ${kunde?.phone ?? "-"}`,
            `Website:      ${felder.get("website") ?? "-"}`,
            `USt-ID:       ${kunde?.tax_ids?.[0]?.value ?? "-"}`,
            `Anschrift:    ${[kunde?.address?.line1, kunde?.address?.postal_code, kunde?.address?.city, kunde?.address?.country].filter(Boolean).join(", ") || "-"}`,
            `Startpunkt:   ${felder.get("startpunkt") ?? "-"}`,
            ``,
            `Clerk-User:   ${userId}`,
            ``,
            `Naechste Schritte (claude/bauplan-modell-a.md, Abschnitt 5):`,
            `  1. scripts/workspace-anlegen.sh "<kundenname>"`,
            `  2. In der Console: API-Schluessel erzeugen und Ausgabenlimit setzen`,
            `  3. select vault.create_secret('<schluessel>', 'anthropic_wrk_<kunde>', '...');`,
            `  4. organizations: anthropic_workspace_id und anthropic_key_secret_id setzen,`,
            `     danach onboarding_status auf 'fertig'.`,
          ].join("\n"),
        });
      }

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
