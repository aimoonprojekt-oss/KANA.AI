"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DBAgent } from "@/lib/platform/supabase";
import { nachAbteilung, tarifeAus } from "@/lib/abteilungen";
import Orbital from "./Orbital";
import Wortrolle from "./Wortrolle";
import PreisBlock from "./PreisBlock";
import { KANAELE, TECHNIK, PlattformLogo } from "./PlattformLogos";
import { SiteNav, SiteFooter } from "./SiteChrome";

interface Props { agents: DBAgent[] }

/* Die Woerter, die sich in der Ueberschrift drehen. Reihenfolge ist die
   Reihenfolge der Rolle. */
const ROLLE = ["Marketing", "Sales", "Support"];

const HERO_LEAD =
  "Unser KI-Agent analysiert deinen Markt, erstellt deine Werbemittel und schaltet sie automatisch – vollständig ohne Agentur, ohne Team, ohne deinen Aufwand.";

/* Der Mehrwert in Zahlen. Aus 04_INHALTE, auf "du" umgestellt. */
const MEHRWERT = [
  { zahl: "20 h+", text: "Marketing-Aufwand pro Woche ohne Agent" },
  { zahl: "0 h",   text: "Mit deinem Agent — er arbeitet allein weiter" },
  { zahl: "24/7",  text: "Dein Agent schläft nie und macht keinen Urlaub" },
  { zahl: "3–5×",  text: "Günstiger als ein eigenes Marketing-Team" },
];

const ABLAUF = [
  { n: "01", title: "Markt analysieren",
    desc: "Der Agent beobachtet Trends, Wettbewerber und Chancen in deiner Nische – rund um die Uhr, automatisch." },
  { n: "02", title: "Creatives erstellen",
    desc: "Optimierte Video- und Foto-Ads aus deinen bestehenden Assets. Kein Briefing, kein Freelancer, kein Warten." },
  { n: "03", title: "Kampagne schalten",
    desc: "Fertige Werbemittel gehen automatisch auf die richtigen Kanäle – ohne manuellen Eingriff." },
  { n: "04", title: "Ergebnisse optimieren",
    desc: "Auswertung, A/B-Test, Anpassung. Der Agent lernt mit jedem Zyklus dazu." },
];

/* Der Satz "auf deutschen Servern" ist bewusst raus: die Datenbank laeuft in
   eu-central-1, die Agenten bei Anthropic in den USA. Siehe Handoff. */
const TRUST = [
  { title: "DSGVO-konform",
    desc: "Alle Daten werden DSGVO-konform verarbeitet. Volle Compliance, volle Kontrolle." },
  { title: "Monatlich kündbar",
    desc: "Kein Jahresvertrag, kein Kleingedrucktes. Du committest dich erst wenn du überzeugt bist." },
  { title: "Setup in wenigen Tagen",
    desc: "Nach dem Onboarding-Gespräch ist dein Agent innerhalb von 3–5 Tagen vollständig einsatzbereit." },
  { title: "Kein internes Team",
    desc: "Keine Hiring-Kosten, kein Management-Aufwand, keine Urlaubsvertretung. Einfach einschalten und loslegen." },
];

/* Dekorative Punkte im Hero-Hintergrund. Reine Zierde, pointer-events: none. */
const HERO_DOTS_CW = [
  { left: 444, top: -7, size: 14, alpha: 0.55 },
  { left: 60, top: 660, size: 11, alpha: 0.45 },
  { left: 830, top: 660, size: 11, alpha: 0.45 },
];
const HERO_DOTS_CCW = [
  { left: 275, top: -5, size: 10, alpha: 0.4 },
  { left: 15, top: 405, size: 8, alpha: 0.35 },
  { left: 535, top: 405, size: 8, alpha: 0.35 },
];

export default function LandingPage({ agents }: Props) {
  const [activeDept, setActiveDept] = useState("marketing");
  const [typed, setTyped] = useState("");

  /* Abteilungen, Agents und Preise kommen aus der Datenbank — nichts mehr
     fest verdrahtet. Damit wirken featured, price_eur und description. */
  const depts = nachAbteilung(agents);
  const tarife = tarifeAus(agents);
  const orbitalDepts = depts.map((d) => ({
    id: d.id, name: d.name, angle: d.angle,
    agents: d.agents.map((a) => ({ id: a.id, name: a.name })),
  }));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(HERO_LEAD);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(HERO_LEAD.slice(0, i));
      if (i >= HERO_LEAD.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, []);

  const active = depts.find((d) => d.id === activeDept) ?? depts[0];

  const tarifKarten = [
    {
      kicker: "Einstieg", name: "Ein Agent", hervor: false, ab: true,
      desc: "Ein digitaler Mitarbeiter aus einer Abteilung deiner Wahl.",
      monat: tarife.abEinAgent, setup: tarife.abSetup, einheit: "je Agent / Monat",
      punkte: ["Ein Agent, ein Arbeitsbereich", "Sessions-Kontingent inklusive", "Chat und Dateiablage", "Monatlich kündbar"],
      cta: "Agent auswählen", href: "/preise",
    },
    {
      kicker: "Empfohlen", name: "Abteilung", hervor: true, ab: true,
      desc: "Alle Agents einer Abteilung, aufeinander abgestimmt.",
      monat: tarife.abAbteilung, setup: tarife.abAbteilungSetup, einheit: "je Abteilung / Monat",
      punkte: ["Alle Agents der Abteilung", "Höheres Freikontingent", "Gemeinsame Vorgaben und Tonlage", "Onboarding-Gespräch inklusive"],
      cta: "Abteilung ansehen", href: "/preise",
    },
    {
      kicker: "Ausbau", name: "Mehrere Abteilungen", hervor: false, ab: false,
      desc: "Marketing, Vertrieb, IT und Content am selben Kern.",
      monat: null, setup: null, einheit: "nach Umfang", stattBetrag: "individuell",
      punkte: ["Beliebige Abteilungen kombinierbar", "Verbrauch gebündelt abgerechnet", "Feste Ansprechperson", "Auswertung im Portal"],
      cta: "Angebot anfragen", href: "/preise",
    },
  ];

  return (
    <div className="landing">
      <SiteNav />

      {/* ── Hero ── */}
      <header className="hero">
        <div className="hero-orbit" aria-hidden="true">
          <div className="hero-orbit__arc" />
          <div className="hero-orbit__ring" style={{ width: 560, height: 560, border: "1px solid rgba(31,75,69,0.2)" }} />
          <div className="hero-orbit__ring" style={{ width: 300, height: 300, border: "1px solid rgba(31,75,69,0.14)" }} />
          <div className="hero-orbit__spin-cw">
            {HERO_DOTS_CW.map((d, i) => (
              <span key={i} className="hero-orbit__pt"
                style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: `rgba(31,75,69,${d.alpha})` }} />
            ))}
          </div>
          <div className="hero-orbit__spin-ccw">
            {HERO_DOTS_CCW.map((d, i) => (
              <span key={i} className="hero-orbit__pt"
                style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: `rgba(31,75,69,${d.alpha})` }} />
            ))}
          </div>
        </div>

        <div className="hero-content">
          <span className="hero-badge">KI-Marketing-Agent · End-to-End</span>
          <h1 className="hero-title">
            <span className="hero-title__zeile">
              Dein <Wortrolle woerter={ROLLE} />
            </span>
            <span className="hero-title__zeile2 accent">läuft.</span>
          </h1>
          <p className="hero-sub">Du baust dein Business.</p>
          <p className="hero-lead">
            {typed}
            {typed.length < HERO_LEAD.length && <span className="caret" />}
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="btn btn-primary btn-lg">Kostenlosen Demo-Call buchen</Link>
            <a href="#ablauf" className="btn btn-ghost btn-lg">So funktioniert es →</a>
          </div>
        </div>
      </header>

      {/* ── Mehrwert in Zahlen ── */}
      <section className="section-numbers" aria-label="Mehrwert">
        {MEHRWERT.map((m) => (
          <div key={m.zahl} className="number-cell">
            <span className="number-cell__val">{m.zahl}</span>
            <span className="number-cell__text">{m.text}</span>
          </div>
        ))}
      </section>

      {/* ── So funktioniert es ── */}
      <section id="ablauf" className="section-plain">
        <div className="section-head">
          <span className="section-tag">So funktioniert es</span>
          <h2 className="section-title">Vier Schritte, dann läuft es allein</h2>
          <p className="section-lead" style={{ maxWidth: "58ch" }}>
            Du gibst das Ziel vor. Den Rest übernimmt der Agent — und zwar jeden Tag, nicht nur beim Start.
          </p>
        </div>
        <div className="steps">
          {ABLAUF.map((s) => (
            <div key={s.n} className="step">
              <span className="step__num">{s.n}</span>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ausbaustufen ── */}
      <section id="ausbaustufen" className="section-orbital">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span className="section-tag">Ausbaustufen</span>
          <h2 className="section-title">Vier Abteilungen, ein Kern</h2>
          <p className="section-lead">
            Du startest mit Marketing. Alles andere hängt am selben Kern und kommt dazu, wenn du es brauchst.
          </p>

          <div className="dept-list">
            {depts.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`dept-row${d.id === activeDept ? " is-active" : ""}`}
                aria-pressed={d.id === activeDept}
                onClick={() => setActiveDept(d.id)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="dept-row__bullet" />
                  <span className="dept-row__name">{d.name}</span>
                </span>
                <span className="dept-row__count">
                  {d.agents.length > 0
                    ? `${d.agents.length} ${d.agents.length === 1 ? "Agent" : "Agents"}`
                    : "in Vorbereitung"}
                </span>
              </button>
            ))}
          </div>

          {active && (
            <p className="section-lead" style={{ fontSize: 15, color: "var(--text-tertiary)" }}>{active.line}</p>
          )}
        </div>

        <div className="orbital-wrap" style={{ display: "flex", justifyContent: "center" }}>
          <Orbital
            depts={orbitalDepts}
            size={560} coreR={43} rInner={145} rOuter={245} spread={46}
            activeDept={activeDept} onDeptChange={setActiveDept}
            labelSize={12} nodeSize={15} nodePad="10px 17px"
          />
        </div>
      </section>

      {/* ── Plattformen ── */}
      <section className="section-platforms" aria-label="Plattformen">
        <div className="platform-block">
          <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Arbeitet mit deinen Kanälen und Shops</span>
          <div className="platform-row">
            {KANAELE.map((l) => <PlattformLogo key={l.name} logo={l} size={26} />)}
          </div>
        </div>
        <div className="platform-block">
          <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Läuft auf</span>
          <div className="platform-row">
            {TECHNIK.map((l) => <PlattformLogo key={l.name} logo={l} size={24} />)}
          </div>
        </div>
      </section>

      {/* ── Preise ── */}
      <section id="preise" className="section-plain">
        <div className="section-head">
          <span className="section-tag">Preise</span>
          <h2 className="section-title">Du zahlst pro Agent. Nicht pro Abteilung.</h2>
          <p className="section-lead" style={{ maxWidth: "58ch" }}>
            Jeder Agent läuft als eigenes Abo, monatlich kündbar. Du fängst mit einem an und nimmst dazu, was du brauchst.
          </p>
        </div>

        <div className="plans">
          {tarifKarten.map((p) => (
            <div key={p.name} className={`plan${p.hervor ? " is-featured" : ""}`}>
              <div className="plan__head">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span className="mono-sm" style={{ color: "var(--accent)" }}>{p.kicker}</span>
                  {p.hervor && <span className="badge badge-solid">meist gewählt</span>}
                </div>
                <span className="plan__name">{p.name}</span>
                <p className="plan__desc">{p.desc}</p>
              </div>
              <PreisBlock
                monat={p.monat} setup={p.setup} einheit={p.einheit}
                ab={p.ab} stattBetrag={p.stattBetrag}
              />
              <ul className="plan__list">
                {p.punkte.map((f) => (
                  <li key={f}><span className="plan__bullet" />{f}</li>
                ))}
              </ul>
              <div className="plan__foot">
                <Link href={p.href} className={`btn btn-full ${p.hervor ? "btn-primary" : "btn-outline"}`}>
                  {p.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="t-meta" style={{ color: "var(--text-muted)", marginTop: 18 }}>
          Alle Beträge netto, zzgl. USt. Die Einrichtung fällt einmal je Agent an und ist in
          jedem Preis oben ausgewiesen — es kommt später nichts dazu.
          {tarife.abteilungName && ` Der Abteilungspreis ist die Summe der Agents in ${tarife.abteilungName}.`}{" "}
          <Link href="/preise" style={{ color: "var(--accent)", fontWeight: 600 }}>Alle Details zu den Preisen →</Link>
        </p>
      </section>

      {/* ── Vertrauen ── */}
      <section id="vertrauen" className="section-trust">
        {TRUST.map((t) => (
          <div key={t.title}>
            <h3 className="trust-title">{t.title}</h3>
            <p className="trust-desc">{t.desc}</p>
          </div>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
