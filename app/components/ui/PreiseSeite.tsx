"use client";

import { useState } from "react";
import Link from "next/link";
import type { DBAgent } from "@/lib/platform/supabase";
import { nachAbteilung, tarifeAus, eur } from "@/lib/abteilungen";
import KanaMark from "./KanaMark";
import { SiteNav, SiteFooter } from "./SiteChrome";

interface Props { agents: DBAgent[] }

/* Bei jaehrlicher Zahlung: zwei Monate geschenkt. Das ist eine
   Geschaeftsentscheidung, kein Designwert — sie steht hier an einer Stelle
   und gehoert perspektivisch in die Datenbank neben die Stripe-Preise. */
const JAHRESFAKTOR = 10 / 12;

const LEISTUNGEN = [
  { title: "Freikontingent",
    desc: "Ein Sessions-Kontingent pro Monat ist enthalten, darüber wird verbrauchsabhängig abgerechnet." },
  { title: "Eigener Arbeitsbereich",
    desc: "Deine Daten, Assets und Ergebnisse liegen abgetrennt und bleiben bei dir." },
  { title: "Onboarding",
    desc: "Ein Gespräch, danach ist der Agent innerhalb von 3–5 Tagen einsatzbereit." },
  { title: "Monatlich kündbar",
    desc: "Kein Jahresvertrag, kein Kleingedrucktes. Abrechnung läuft über Stripe." },
];

const FAQ = [
  { q: "Wie wird der Verbrauch berechnet?",
    a: "Jeder Agent hat ein monatliches Sessions-Kontingent. Was darüber läuft, wird verbrauchsabhängig abgerechnet und ist im Portal unter Verbrauch jederzeit einsehbar." },
  { q: "Kann ich Agents zwischendurch tauschen?",
    a: "Ja. Du kannst zum Monatsende wechseln, dazunehmen oder abbestellen. Bestehende Sitzungen und Dateien bleiben erhalten." },
  { q: "Was kostet das Onboarding?",
    a: "Nichts. Das Gespräch und die Einrichtung sind im Abo enthalten, danach ist der Agent innerhalb von 3–5 Tagen einsatzbereit." },
  { q: "Gibt es eine Mindestlaufzeit?",
    a: "Nein. Alle Abos sind monatlich kündbar, ohne Jahresvertrag." },
];

export default function PreiseSeite({ agents }: Props) {
  const [jaehrlich, setJaehrlich] = useState(false);
  const [offen, setOffen] = useState<number | null>(0);

  const tarife = tarifeAus(agents);
  const depts = nachAbteilung(agents).filter((d) => d.agents.length > 0);

  const betrag = (n: number | null) => {
    if (n === null) return "—";
    return `ab ${eur(jaehrlich ? n * JAHRESFAKTOR : n)}`;
  };
  const einheit = (was: string) => `je ${was} / Monat${jaehrlich ? ", jährlich gezahlt" : ""}`;

  const plans = [
    { kicker: "Einstieg", name: "Ein Agent", hervor: false,
      desc: "Ein digitaler Mitarbeiter aus einer Abteilung deiner Wahl.",
      preis: betrag(tarife.abEinAgent), unit: einheit("Agent"),
      punkte: ["Ein Agent, ein Arbeitsbereich", "Sessions-Kontingent inklusive", "Chat und Dateiablage", "Monatlich kündbar"],
      cta: "Agent auswählen", href: "/sign-up" },
    { kicker: "Empfohlen", name: "Abteilung", hervor: true,
      desc: "Alle Agents einer Abteilung, aufeinander abgestimmt.",
      preis: betrag(tarife.abAbteilung), unit: einheit("Abteilung"),
      punkte: ["Alle Agents der Abteilung", "Höheres Freikontingent", "Gemeinsame Vorgaben und Tonlage", "Onboarding-Gespräch inklusive"],
      cta: "Abteilung buchen", href: "/sign-up" },
    { kicker: "Ausbau", name: "Mehrere Abteilungen", hervor: false,
      desc: "Marketing, Vertrieb, IT und Content am selben Kern.",
      preis: "individuell", unit: "nach Umfang",
      punkte: ["Beliebige Abteilungen kombinierbar", "Verbrauch gebündelt abgerechnet", "Feste Ansprechperson", "Auswertung im Portal"],
      cta: "Angebot anfragen", href: "mailto:hallo@kana-ai.de?subject=Angebot%20mehrere%20Abteilungen" },
  ];

  return (
    <div className="landing">
      <SiteNav aktiv="preise" />

      <header className="preise-head">
        <h1 className="t-h1" style={{ textAlign: "center", maxWidth: "20ch" }}>
          Du zahlst pro Agent.<br />Nicht pro Abteilung.
        </h1>
        <p className="t-lead" style={{ color: "var(--text-secondary)", maxWidth: "58ch", textAlign: "center" }}>
          Jeder Agent läuft als eigenes Abo, monatlich kündbar. Du fängst mit einem an und nimmst dazu, was du brauchst.
        </p>
        <div className="seg" style={{ marginTop: 18 }} role="group" aria-label="Abrechnungszeitraum">
          <button type="button" className={`seg-item${!jaehrlich ? " active" : ""}`} onClick={() => setJaehrlich(false)}>Monatlich</button>
          <button type="button" className={`seg-item${jaehrlich ? " active" : ""}`} onClick={() => setJaehrlich(true)}>Jährlich</button>
        </div>
        <span className="t-meta" style={{ color: "var(--text-muted)" }}>
          {jaehrlich
            ? "Bei jährlicher Zahlung sind zwei Monate geschenkt"
            : "Monatlich kündbar, keine Einrichtungsgebühr"}
        </span>
      </header>

      <section className="section-plain" style={{ borderTop: "none" }}>
        <div className="plans">
          {plans.map((p) => (
            <div key={p.name} className={`plan${p.hervor ? " is-featured" : ""}`}>
              <div className="plan__head">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span className="mono-sm" style={{ color: "var(--accent)" }}>{p.kicker}</span>
                  {p.hervor && <span className="badge badge-solid">meist gewählt</span>}
                </div>
                <span className="plan__name">{p.name}</span>
                <p className="plan__desc">{p.desc}</p>
              </div>
              <div className="plan__price">
                <span className="plan__amount">{p.preis}</span>
                <span className="plan__unit">{p.unit}</span>
              </div>
              <ul className="plan__list">
                {p.punkte.map((f) => <li key={f}><span className="plan__bullet" />{f}</li>)}
              </ul>
              <div className="plan__foot">
                <Link href={p.href} className={`btn btn-full ${p.hervor ? "btn-primary" : "btn-outline"}`}>{p.cta}</Link>
              </div>
            </div>
          ))}
        </div>

        {/* Was tatsaechlich buchbar ist, kommt aus der Datenbank —
            deshalb hier die echten Agenten je Abteilung mit ihrem Preis. */}
        {depts.length > 0 && (
          <div className="card" style={{ marginTop: 32, padding: 0 }}>
            <div style={{ padding: "24px 26px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="t-h4">Was du heute buchen kannst</span>
                <span className="t-meta" style={{ color: "var(--text-tertiary)" }}>Preise je Agent, aus dem Katalog</span>
              </div>
              <span className="t-meta" style={{ color: "var(--text-muted)" }}>Alle Preise netto, zzgl. USt.</span>
            </div>
            {depts.map((d) => (
              <div key={d.id} style={{ borderTop: "1px solid var(--hairline-soft)" }}>
                <div style={{ padding: "14px 26px 6px" }}>
                  <span className="mono-sm" style={{ color: "var(--text-muted)" }}>{d.name}</span>
                </div>
                {d.agents.map((a) => (
                  <div key={a.id} className="table-row" style={{ gridTemplateColumns: "1fr 140px", paddingLeft: 26, paddingRight: 26, borderBottom: "none" }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</span>
                      {a.description && (
                        <span className="t-meta" style={{ display: "block", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.description}
                        </span>
                      )}
                    </span>
                    <span className="mono-num" style={{ textAlign: "right", color: "var(--text-primary)" }}>
                      {a.price_eur > 0 ? `${eur(a.price_eur)} / Mon.` : "auf Anfrage"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: 20, padding: 0 }}>
          <div style={{ padding: "24px 26px 18px" }}>
            <span className="t-h4">Was im Preis steckt</span>
            <span className="t-meta" style={{ display: "block", color: "var(--text-tertiary)", marginTop: 6 }}>
              Gilt für jeden Agent, unabhängig von der Abteilung
            </span>
          </div>
          <div className="leistungen">
            {LEISTUNGEN.map((l) => (
              <div key={l.title} className="leistung">
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>{l.title}</div>
                <p className="t-meta" style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}>{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-faq">
        <div>
          <span className="mono-sm" style={{ color: "var(--accent)", display: "block", marginBottom: 14 }}>
            Häufige Fragen zum Preis
          </span>
          {FAQ.map((f, i) => (
            <div key={f.q} className={`faq-item${offen === i ? " is-open" : ""}`}>
              <button type="button" className="faq-q" aria-expanded={offen === i} onClick={() => setOffen(offen === i ? null : i)}>
                {f.q}<span className="faq-plus" aria-hidden="true">+</span>
              </button>
              <div className="faq-a"><p>{f.a}</p></div>
            </div>
          ))}
        </div>

        <aside className="cta-petrol">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <KanaMark size={44} variant="onaccent" motion="spin" breathe />
            <span className="t-h3" style={{ marginTop: 8 }}>Unsicher, welcher Agent zuerst?</span>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(241,239,233,0.8)" }}>
              Im Demo-Call schauen wir dein Setup an und sagen dir, welche Abteilung bei dir den größten Hebel hat.
              Kostenlos, 30 Minuten.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Link href="/sign-up" className="btn btn-lg" style={{ background: "#F1EFE9", color: "var(--accent-dark)" }}>
              Demo-Call buchen
            </Link>
            <a href="mailto:hallo@kana-ai.de" className="btn btn-lg"
               style={{ color: "#F1EFE9", border: "1px solid rgba(241,239,233,0.4)" }}>
              Kontakt
            </a>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </div>
  );
}
