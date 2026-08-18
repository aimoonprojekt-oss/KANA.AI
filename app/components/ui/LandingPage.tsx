"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DBAgent } from "@/lib/platform/supabase";
import { nachAbteilung } from "@/lib/abteilungen";
import KanaMark, { KanaLogo } from "./KanaMark";
import Orbital from "./Orbital";

interface Props { agents: DBAgent[] }

const HERO_LEAD =
  "Unser KI-Agent analysiert deinen Markt, erstellt deine Werbemittel und schaltet sie automatisch – vollständig ohne Agentur, ohne Team, ohne deinen Aufwand.";

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
  const [scrolled, setScrolled] = useState(false);
  const [typed, setTyped] = useState("");

  /* Abteilungen und Agents kommen aus der Datenbank — nichts mehr fest
     verdrahtet. Damit wirken featured, price_eur und description endlich. */
  const depts = nachAbteilung(agents);
  const orbitalDepts = depts.map((d) => ({
    id: d.id,
    name: d.name,
    angle: d.angle,
    agents: d.agents.map((a) => ({ id: a.id, name: a.name })),
  }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Schreibmaschine auf der Einleitung — der einzige Rest des alten Zierrats,
     bewusst behalten. Die Zeile hat eine Mindesthoehe, damit nichts springt. */
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

  return (
    <div className="landing">
      {/* ── Kopfleiste ── */}
      <nav className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
        <Link href="/" aria-label="KANA AI — Startseite">
          <KanaLogo size={26} fontSize={19} />
        </Link>
        <ul className="nav-links">
          <li><a href="#ausbaustufen">Abteilungen</a></li>
          <li><a href="#vertrauen">Vertrauen</a></li>
          <li><Link href="/sign-in">Anmelden</Link></li>
        </ul>
        <div className="nav-actions">
          <Link href="/sign-up" className="btn btn-outline">Kostenlos starten</Link>
        </div>
      </nav>

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
            Dein Marketing<br />
            <span className="accent">läuft.</span>
          </h1>
          <p className="hero-sub">Du baust dein Business.</p>
          <p className="hero-lead">
            {typed}
            {typed.length < HERO_LEAD.length && <span className="caret" />}
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="btn btn-primary btn-lg">Kostenlosen Demo-Call buchen</Link>
            <a href="#ausbaustufen" className="btn btn-ghost btn-lg">So funktioniert es →</a>
          </div>
        </div>
      </header>

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
            <p className="section-lead" style={{ fontSize: 15, color: "var(--text-tertiary)" }}>
              {active.line}
            </p>
          )}
        </div>

        <div className="orbital-wrap" style={{ display: "flex", justifyContent: "center" }}>
          <Orbital
            depts={orbitalDepts}
            size={560}
            coreR={43}
            rInner={145}
            rOuter={245}
            spread={46}
            activeDept={activeDept}
            onDeptChange={setActiveDept}
            labelSize={12}
            nodeSize={15}
            nodePad="10px 17px"
          />
        </div>
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

      {/* ── Fußzeile ── */}
      <footer className="landing-footer">
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KanaMark size={18} />
          <span>© {new Date().getFullYear()} KANA AI. Alle Rechte vorbehalten.</span>
        </span>
        {/* Ziel ist /recht?doc=... — die Seite kommt mit dem Recht-Entwurf.
            Bis dahin bleibt es wie bisher ein toter Anker, kein 404. */}
        <span className="footer-links">
          <a href="#">Impressum</a>
          <a href="#">Datenschutz</a>
        </span>
      </footer>
    </div>
  );
}
