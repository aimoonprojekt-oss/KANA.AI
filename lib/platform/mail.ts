/**
 * E-Mail-Versand über Resend.
 *
 * Bisher stand der Resend-Aufruf als roher fetch mitten in
 * app/api/widget-chat/route.ts. Beim zweiten Anwendungsfall (Onboarding-
 * Benachrichtigung) wäre er ein zweites Mal abgeschrieben worden — daher
 * hier an einer Stelle.
 *
 * Bewusst ohne SDK: Ein fetch auf einen dokumentierten Endpunkt ist weniger
 * Abhängigkeit als ein Paket, und der Aufruf ist vier Zeilen lang.
 *
 * Fehler werden protokolliert, nicht geworfen. Eine nicht zugestellte
 * Benachrichtigung darf niemals einen Kauf oder eine Eskalation scheitern
 * lassen — der Vorgang selbst ist wichtiger als die Nachricht darüber.
 */

const RESEND_ENDPUNKT = "https://api.resend.com/emails";

export type MailAuftrag = {
  an: string | string[];
  betreff: string;
  /** Reiner Text. Wird als <pre> verschickt, damit Umbrüche erhalten bleiben. */
  text: string;
  /** Absender. Standard: die in RESEND_ABSENDER hinterlegte Adresse. */
  von?: string;
};

/**
 * Verschickt eine Mail. Gibt zurück, ob es geklappt hat — der Aufrufer darf
 * das ignorieren.
 */
export async function mailSenden(auftrag: MailAuftrag): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const von = auftrag.von ?? process.env.RESEND_ABSENDER;

  if (!key || !von) {
    console.warn(
      "[mail] RESEND_API_KEY oder RESEND_ABSENDER fehlt — Nachricht nicht verschickt:",
      auftrag.betreff
    );
    return false;
  }

  try {
    const antwort = await fetch(RESEND_ENDPUNKT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: von,
        to: Array.isArray(auftrag.an) ? auftrag.an : [auftrag.an],
        subject: auftrag.betreff,
        text: auftrag.text,
      }),
    });

    if (!antwort.ok) {
      console.error(
        `[mail] Resend antwortete ${antwort.status}: ${await antwort.text()}`
      );
      return false;
    }
    return true;
  } catch (fehler) {
    console.error("[mail] Versand fehlgeschlagen:", fehler);
    return false;
  }
}

/** Die Adressen, die über neue Kunden informiert werden. */
export function betriebsAdressen(): string[] {
  return (process.env.ONBOARDING_MAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
