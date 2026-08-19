"use client";

import Link from "next/link";
import KanaMark, { KanaLogo } from "./KanaMark";

/* Der Rahmen um das Clerk-Formular: links Formular, rechts die Begruendung
   auf Petrol. Zwei Zustaende — Anmelden und Registrieren — die sich in
   Ueberschrift, Text und den vier Punkten unterscheiden.

   Das Formular selbst kommt von Clerk. Es wird ueber `appearance` an die
   Tokens angeglichen; die Werte stehen unten an einer Stelle. */

type Modus = "anmelden" | "registrieren";

const TEXTE: Record<Modus, {
  headline: string; sub: string; pitchTitle: string; pitchText: string; punkte: string[];
}> = {
  anmelden: {
    headline: "Willkommen zurück",
    sub: "Melde dich an, um zu deinen Agents und laufenden Aufträgen zu kommen.",
    pitchTitle: "Deine Agents haben weitergearbeitet.",
    pitchText: "Laufende Aufträge, Ergebnisse und Dateien liegen dort, wo du sie zuletzt gelassen hast.",
    punkte: [
      "Laufende Aufträge siehst du sofort im Portal",
      "Erzeugte Dateien bleiben in der Sitzung",
      "Verbrauch und Kosten jederzeit einsehbar",
      "Support direkt aus dem Portal heraus",
    ],
  },
  registrieren: {
    headline: "Arbeitsbereich anlegen",
    sub: "Nach der Registrierung wählst du die erste Abteilung und buchst den passenden Agent.",
    pitchTitle: "In wenigen Tagen arbeitet der erste Agent.",
    pitchText: "Onboarding-Gespräch, Einrichtung, erste Ergebnisse — ohne Agentur, ohne zusätzliche Stelle.",
    punkte: [
      "Monatlich kündbar, kein Jahresvertrag",
      "Setup nach dem Gespräch in 3–5 Tagen",
      "Ein Agent genügt für den Anfang",
      "Abteilungen kommen dazu, wenn du sie brauchst",
    ],
  },
};

export default function ZugangRahmen({ modus, children }: { modus: Modus; children: React.ReactNode }) {
  const t = TEXTE[modus];
  const andere: Modus = modus === "anmelden" ? "registrieren" : "anmelden";

  return (
    <div className="zugang">
      <div className="zugang-shell">
        <div className="zugang-form">
          <div className="zugang-form__top">
            <Link href="/" aria-label="KANA AI — Startseite"><KanaLogo size={26} fontSize={19} /></Link>
            <Link href="/" className="t-ui" style={{ color: "var(--text-secondary)" }}>← Zurück zur Seite</Link>
          </div>

          <div className="zugang-form__body">
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              <Link href="/sign-in" className={`seg-item${modus === "anmelden" ? " active" : ""}`}>Anmelden</Link>
              <Link href="/sign-up" className={`seg-item${modus === "registrieren" ? " active" : ""}`}>Registrieren</Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1 }}>{t.headline}</h1>
              <p className="t-ui" style={{ fontWeight: 400, fontSize: 15, lineHeight: 1.6, color: "var(--text-tertiary)" }}>{t.sub}</p>
            </div>

            {children}

            <span className="t-ui" style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
              {modus === "anmelden" ? "Noch keinen Zugang?" : "Schon ein Zugang vorhanden?"}{" "}
              <Link href={andere === "anmelden" ? "/sign-in" : "/sign-up"} style={{ fontWeight: 600, color: "var(--accent)" }}>
                {andere === "anmelden" ? "Anmelden" : "Registrieren"}
              </Link>
            </span>
          </div>
        </div>

        <aside className="zugang-pitch">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <KanaMark size={76} variant="onaccent" motion="spin" />
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.12 }}>{t.pitchTitle}</span>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(241,239,233,0.82)" }}>{t.pitchText}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {t.punkte.map((p) => (
              <div key={p} className="zugang-pitch__row">
                <span className="zugang-pitch__dot" />
                <span style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(241,239,233,0.9)" }}>{p}</span>
              </div>
            ))}
          </div>

          <span style={{ fontSize: 13, color: "rgba(241,239,233,0.6)" }}>
            Abrechnung über Stripe. Deine Daten liegen in einem abgetrennten Arbeitsbereich.
          </span>
        </aside>
      </div>
    </div>
  );
}

/* Clerk an die Tokens angleichen. Steht hier, damit Anmelden und
   Registrieren nicht auseinanderlaufen. */
export const clerkHell = {
  variables: {
    colorPrimary: "#1F4B45",
    colorBackground: "#FBFAF7",
    colorInputBackground: "#FBFAF7",
    colorText: "#14181A",
    colorTextSecondary: "#4A5250",
    colorInputText: "#14181A",
    colorNeutral: "#5F6866",
    colorDanger: "#8C3A32",
    borderRadius: "0px",
    fontFamily: "'Familjen Grotesk', system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "none" },
    card: { background: "transparent", border: "none", boxShadow: "none", padding: 0, width: "100%" },
    header: { display: "none" },
    footer: { background: "transparent" },
    /* Clerk setzt selbst eine Zeile "Schon ein Zugang vorhanden? Anmelden".
       Die Seite bringt ihre eigene mit — sonst steht sie doppelt da. */
    footerAction: { display: "none" },
    socialButtonsBlockButton: {
      border: "1px solid rgba(20,24,26,0.2)", borderRadius: 0,
      color: "#14181A", fontSize: "15px", fontWeight: 600,
    },
    socialButtonsBlockButton__hover: { background: "#F6F4EF" },
    dividerLine: { background: "rgba(20,24,26,0.12)" },
    dividerText: { color: "#5F6866", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" },
    formFieldLabel: {
      color: "#5F6866", fontFamily: "'JetBrains Mono', monospace",
      fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" as const,
    },
    formFieldInput: {
      background: "#FBFAF7", border: "1px solid rgba(20,24,26,0.18)",
      borderRadius: 0, color: "#14181A", fontSize: "15px", padding: "13px 15px",
    },
    formFieldInput__focus: { borderColor: "#1F4B45", boxShadow: "none" },
    formButtonPrimary: {
      background: "#1F4B45", border: "1px solid #1F4B45", borderRadius: 0,
      color: "#FBFAF7", fontSize: "15px", fontWeight: 600, padding: "15px 22px",
      textTransform: "none" as const, boxShadow: "none",
    },
    formButtonPrimary__hover: { background: "#14312D" },
    formFieldAction: { color: "#1F4B45", fontWeight: 600, fontSize: "14px" },
    identityPreviewText: { color: "#14181A" },
    identityPreviewEditButton: { color: "#1F4B45" },
    formResendCodeLink: { color: "#1F4B45" },
    otpCodeFieldInput: { border: "1px solid rgba(20,24,26,0.18)", borderRadius: 0, color: "#14181A" },
  },
};
