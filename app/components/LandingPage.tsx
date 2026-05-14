"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Search, Lightbulb, Send,
  Zap, BarChart2, CheckCircle, Lock, Clock, Activity,
} from "lucide-react";
import type { DBAgent } from "@/lib/supabase";

/* Props bleiben kompatibel mit app/page.tsx */
interface Props { agents: DBAgent[] }

/* ── FAQ Daten ─────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Kann ich den Agent selbst steuern oder anpassen?",
    a: "Bewusst nicht – und das ist euer Vorteil. Ihr bekommt einen managed Agent mit geprüfter Qualität. Ihr gebt das Ziel vor, wir stellen sicher dass der Agent es zuverlässig und konsistent erreicht. Keine Fehlkonfiguration, kein Qualitätsverlust.",
  },
  {
    q: "Wie schnell sind erste Ergebnisse sichtbar?",
    a: "Nach einem kurzen Onboarding-Gespräch ist euer Agent innerhalb weniger Tage vollständig einsatzbereit. Erste Analysen und Creatives liefert er ab dem ersten Tag aktiver Nutzung.",
  },
  {
    q: "Ist meine Werbestrategie und meine Daten sicher?",
    a: "Ja – vollständig. Alle Daten werden DSGVO-konform verarbeitet. Eure Strategie, eure Assets und eure Ergebnisse bleiben ausschließlich bei euch.",
  },
  {
    q: "Warum lohnt sich das verglichen mit einer Agentur oder einem Team?",
    a: "Eine eigene Marketing-Abteilung kostet 8.000–15.000€/Monat – plus Einarbeitung, Fluktuation und Management-Aufwand. Eine klassische Agentur liefert generische Lösungen. Euer Agent kennt euren Markt, arbeitet 24/7 und skaliert ohne Mehrkosten.",
  },
  {
    q: "Was wenn ich unzufrieden bin?",
    a: "Monatlich kündbar, kein Risiko, kein Kleingedrucktes. Wir sind überzeugt von unseren Ergebnissen – und ihr sollt es auch sein, bevor ihr langfristig committet.",
  },
];

/* ── Problem Tags ──────────────────────────────────────────────────────────── */
const PROBLEM_TAGS = [
  "Markt beobachten", "Konkurrenz-Ads analysieren", "Creatives briefen",
  "Videos & Fotos produzieren", "Ads testen", "Ergebnisse auswerten",
  "Optimieren & hochladen", "Wiederholen",
];

/* ── How it works steps ────────────────────────────────────────────────────── */
const HOW_STEPS = [
  { icon: <Search size={20} />,    n: "01", title: "Markt analysieren",     desc: "Der Agent beobachtet kontinuierlich Trends, Wettbewerber und Chancen in deiner Nische – rund um die Uhr, automatisch." },
  { icon: <Lightbulb size={20} />, n: "02", title: "Creatives erstellen",   desc: "Optimierte Video- und Foto-Ads aus deinen bestehenden Assets. Kein Briefing, kein Freelancer, kein Warten." },
  { icon: <Send size={20} />,      n: "03", title: "Kampagne schalten",     desc: "Fertige Werbemittel werden automatisch auf den richtigen Kanälen veröffentlicht – vollständig ohne manuellen Eingriff." },
  { icon: <BarChart2 size={20} />, n: "04", title: "Ergebnisse optimieren", desc: "Kontinuierliche Auswertung, A/B-Testing und Anpassung. Der Agent lernt mit jedem Zyklus dazu." },
];

/* ── Sub-Agent Cards ───────────────────────────────────────────────────────── */
const SUB_AGENTS = [
  { icon: <Search size={22} />,    tag: "Research",   name: "Marktanalyse-Agent",      desc: "Beobachtet Trends, Chancen und Verschiebungen in deiner Nische – kontinuierlich und automatisch." },
  { icon: <BarChart2 size={22} />, tag: "Analytics",  name: "Ad-Analyse-Agent",        desc: "Wertet Konkurrenz-Ads systematisch aus. Extrahiert Hooks, Formate und Best Practices für die nächste Kampagne." },
  { icon: <Lightbulb size={22} />, tag: "Creative",   name: "Creative-Agent",          desc: "Erstellt optimierte Video- und Foto-Ads aus deinen bestehenden Assets. Kein Briefing, kein Freelancer, kein Warten." },
  { icon: <Send size={22} />,      tag: "Publishing", name: "Veröffentlichungs-Agent", desc: "Schaltet fertige Creatives automatisch auf den richtigen Kanälen. Vollständig ohne manuellen Eingriff." },
];

/* ── Trust Cards ───────────────────────────────────────────────────────────── */
const TRUST_CARDS = [
  { icon: <Lock size={20} />,      title: "DSGVO-konform",         desc: "Alle Daten werden auf deutschen Servern verarbeitet. Volle Compliance, volle Kontrolle." },
  { icon: <Activity size={20} />,  title: "Monatlich kündbar",     desc: "Kein Jahresvertrag, kein Kleingedrucktes. Ihr committet euch erst wenn ihr überzeugt seid." },
  { icon: <Clock size={20} />,     title: "Setup in wenigen Tagen",desc: "Nach dem Onboarding-Gespräch ist euer Agent innerhalb von 3–5 Tagen vollständig einsatzbereit." },
  { icon: <Zap size={20} />,       title: "Kein internes Team",    desc: "Keine Hiring-Kosten, kein Management-Aufwand, keine Urlaubsvertretung. Einfach einschalten und loslegen." },
];

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage({ agents: _ }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [openFaq, setOpenFaq]     = useState<number | null>(null);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);

  /* ── Neural Network Canvas ── */
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let W = 0, H = 0;
    const NUM = 70, DIST = 160, SPEED = 0.4;
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let particles: P[] = [];
    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    function init() {
      resize();
      particles = Array.from({ length: NUM }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * SPEED, vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.8 + 1,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${(1 - d / DIST) * 0.32})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(129,140,248,0.65)"; ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });
      animId = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", resize);
    init(); draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  /* ── Scroll Reveal ── */
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Sticky CTA nach Hero ── */
  useEffect(() => {
    const onScroll = () => setStickyCtaVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ══════════════════════════════════════════════════════ NAV */}
      <nav className="landing-nav">
        <a href="#" className="nav-logo">
          <span className="logo-dot" />
          KANA AI
        </a>
        <ul className="nav-links">
          <li><a href="#how">So funktioniert es</a></li>
          <li><a href="#leistungen">Leistungen</a></li>
          <li><a href="#preise">Preise</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
        </ul>
        <div className="nav-actions">
          <Link href="/sign-in" className="btn btn-ghost">Anmelden</Link>
          <a href="#kontakt" className="btn btn-primary">
            Demo buchen <ArrowRight size={15} />
          </a>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════ STICKY CTA */}
      <div style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 999,
        opacity: stickyCtaVisible ? 1 : 0, transform: stickyCtaVisible ? "translateY(0)" : "translateY(16px)",
        transition: "all 0.35s ease", pointerEvents: stickyCtaVisible ? "auto" : "none",
      }}>
        <a href="#kontakt" className="btn btn-primary" style={{ padding: "14px 24px", fontSize: "0.9rem", boxShadow: "0 8px 32px rgba(99,102,241,0.5)" }}>
          Demo buchen <ArrowRight size={15} />
        </a>
      </div>

      {/* ══════════════════════════════════════════════════════ HERO */}
      <section className="hero">
        <canvas ref={canvasRef} id="heroCanvas" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div>
            <div className="hero-badge">
              <span className="pulse" />
              KI-Marketing-Agent · End-to-End
            </div>
            <h1 className="hero-title">
              Dein Marketing{" "}
              <span className="highlight">läuft.</span>
              <br />
              <span style={{ fontSize: "0.88em", fontStyle: "italic", opacity: 0.9 }}>
                Du baust dein Business.
              </span>
            </h1>
            <p className="hero-sub">
              Unser KI-Agent analysiert deinen Markt, erstellt deine Werbemittel
              und schaltet sie automatisch – vollständig ohne Agentur, ohne Team,
              ohne deinen Aufwand.
            </p>
            <div className="hero-actions">
              <a href="#kontakt" className="btn btn-primary">
                Kostenlosen Demo-Call buchen <ArrowRight size={15} />
              </a>
              <a href="#how" className="btn btn-outline">
                So funktioniert es →
              </a>
            </div>
          </div>

          {/* Floating Agent Cards */}
          <div className="hero-visual">
            <div className="agent-cards-grid">
              {[
                { icon: <Search size={20} />,    name: "Marktanalyse",  dept: "Research"  },
                { icon: <BarChart2 size={20} />, name: "Ad-Analyse",    dept: "Analytics" },
                { icon: <Lightbulb size={20} />, name: "Creative-Agent",dept: "Creative"  },
                { icon: <Send size={20} />,      name: "Publishing",    dept: "Automation"},
              ].map(card => (
                <div key={card.name} className="agent-preview-card">
                  <div className="agent-card-icon">{card.icon}</div>
                  <div className="agent-card-name">{card.name}</div>
                  <div className="agent-card-dept">{card.dept}</div>
                  <div className="agent-card-status">
                    <span className="status-dot" />Aktiv
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ STATS */}
      <div className="stats-bar" id="statsBar">
        <div className="stats-bar-inner">
          <div className="stat-item">
            <div className="stat-number" style={{ color: "#F87171" }}>20h+</div>
            <div className="stat-label">Marketing-Aufwand pro Woche ohne Agent</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" style={{ color: "var(--success)" }}>0h</div>
            <div className="stat-label">Mit deinem Agent – vollautomatisch</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">24/7</div>
            <div className="stat-label">Dein Agent schläft nie</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">3–5×</div>
            <div className="stat-label">Günstiger als ein eigenes Marketing-Team</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ PROBLEM */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-tag reveal">Das Problem</div>
          <h2 className="section-title reveal">
            Professionelles Marketing<br />ist ein Vollzeitjob.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 40 }}>
            Wer heute wirklich sichtbar sein will, braucht kontinuierliche Analyse,
            starke Creatives und schnelle Reaktion auf den Markt. Das kostet Zeit –
            bis zu 20 Stunden pro Woche.
          </p>

          {/* Tag Cloud */}
          <div className="reveal" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 48 }}>
            {PROBLEM_TAGS.map((tag, i) => (
              <span key={tag} style={{
                padding: "8px 16px", borderRadius: 100,
                background: i % 2 === 0 ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${i % 2 === 0 ? "var(--accent-border)" : "var(--border)"}`,
                fontSize: "0.85rem", fontWeight: 600,
                color: i % 2 === 0 ? "var(--accent-bright)" : "var(--text-secondary)",
              }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Closing statement */}
          <div className="reveal" style={{
            padding: "28px 36px", borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
            border: "1px solid var(--accent-border)",
          }}>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.6 }}>
              Das ist kein Marketing – das ist ein Vollzeitjob.{" "}
              <span style={{ color: "var(--accent-bright)" }}>
                Genau dieser Job gehört ab jetzt deinem Agent.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ HOW IT WORKS */}
      <section className="landing-section" id="how" style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
        <div className="section-inner">
          <div className="section-tag reveal">End-to-End Automatisierung</div>
          <h2 className="section-title reveal">
            Vom Markt-Signal zum fertigen Ad –<br />vollautomatisch.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 56 }}>
            Kein Briefing. Kein Warten. Kein manuelles Hochladen.
            Dein Agent übernimmt den kompletten Kreislauf.
          </p>

          {/* 4 Steps with arrows */}
          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, alignItems: "start" }}>
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} style={{ display: "flex", alignItems: "flex-start" }}>
                <div className="step-card" style={{ flex: 1, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", padding: 28, border: "1px solid var(--border)" }}>
                  <div className="step-number">{step.n}</div>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
                {i < HOW_STEPS.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", marginTop: 60, color: "var(--accent-bright)", fontSize: "1.4rem", fontWeight: 900, flexShrink: 0 }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ VERGLEICH */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-tag reveal">Der echte Vergleich</div>
          <h2 className="section-title reveal">
            Nicht Agentur gegen Agent –<br />Team gegen Agent.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 48 }}>
            Eine eigene Marketing-Abteilung kostet 8.000–15.000€ im Monat.
            Dein Agent liefert dieselbe Arbeit – für einen Bruchteil davon.
          </p>

          {/* Comparison Table */}
          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Left: Team */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "rgba(248,113,113,0.07)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#F87171", marginBottom: 4 }}>Marketing-Team</div>
                <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>2–3 Personen, Festanstellung</div>
              </div>
              {[
                "8.000–15.000€ / Monat",
                "Bürozeiten, Urlaub, Krankheit",
                "3–6 Monate bis Vollleistung",
                "Jede Erweiterung = neue Stelle",
                "HR, Briefings, Kontrolle",
              ].map(item => (
                <div key={item} style={{ padding: "14px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  <span style={{ color: "#F87171", fontWeight: 700, fontSize: "1rem" }}>✕</span>
                  {item}
                </div>
              ))}
            </div>

            {/* Right: Agent */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "0 0 40px rgba(99,102,241,0.1)" }}>
              <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--accent-border)", background: "var(--accent-glow)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent-bright)", marginBottom: 4 }}>Dein KI-Marketing-Agent</div>
                <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>End-to-End, vollautomatisch</div>
              </div>
              {[
                "Bis zu 5× günstiger als ein Team",
                "24/7 – kein Ausfall, kein Urlaub",
                "Einsatzbereit in wenigen Tagen",
                "Mehr Märkte, gleicher Preis",
                "Produkt, Kunden, Wachstum",
              ].map(item => (
                <div key={item} style={{ padding: "14px 28px", borderBottom: "1px solid rgba(99,102,241,0.12)", display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  <CheckCircle size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* ROI Box */}
          <div className="reveal" style={{
            padding: "28px 36px", borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))",
            border: "1px solid var(--accent-border)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent-bright)", marginBottom: 10 }}>ROI-Hinweis</div>
            <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.75 }}>
              Die eigentliche Frage ist nicht der Preis – sondern{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>was es kostet, wenn ihr es nicht habt.</span>{" "}
              Jede Woche ohne optimiertes Marketing ist verlorenes Umsatzpotenzial.
              Jeder Euro den euer Agent investiert, soll mehrfach zurückkommen –
              durch bessere Ads, höhere Reichweite und Zeit die ihr in euer Kerngeschäft steckt.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ LEISTUNGEN */}
      <section className="landing-section" id="leistungen" style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
        <div className="section-inner">
          <div className="section-tag reveal">Leistungen</div>
          <h2 className="section-title reveal">
            Einzelne Agents oder<br />die komplette Abteilung.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 56 }}>
            Starte gezielt mit einem spezifischen Agent – oder hol dir das komplette End-to-End-Paket.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 20 }}>
            {SUB_AGENTS.map(agent => (
              <div key={agent.name} className="agent-card-full reveal">
                <div className="agent-full-icon">{agent.icon}</div>
                <div className="agent-full-tag">{agent.tag}</div>
                <div className="agent-full-name">{agent.name}</div>
                <div className="agent-full-desc">{agent.desc}</div>
              </div>
            ))}
          </div>

          {/* Bundle Banner */}
          <div className="reveal" style={{
            padding: "36px 40px", borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))",
            border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
          }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent-bright)", marginBottom: 8 }}>
                Komplettpaket
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: 6 }}>
                Komplette Marketing-Abteilung – End-to-End
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Alle vier Agents arbeiten nahtlos zusammen. Ein Prozess, ein Preis, null Aufwand für dich.
              </p>
            </div>
            <a href="#kontakt" className="btn btn-primary" style={{ flexShrink: 0, padding: "14px 28px" }}>
              Jetzt anfragen <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ PREISE */}
      <section className="landing-section" id="preise">
        <div className="section-inner">
          <div className="section-tag reveal">Transparente Preise</div>
          <h2 className="section-title reveal">
            Keine versteckten Kosten.<br />Monatlich kündbar.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 56 }}>
            Wähle den Plan der zu deiner Unternehmensgröße passt – und skaliere jederzeit hoch.
          </p>

          <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              {
                name: "Starter", highlight: false,
                sub: "Für den Einstieg",
                features: ["1 Agent", "20 Runs / Monat", "1 Markt / Nische", "E-Mail Support"],
              },
              {
                name: "Growth", highlight: true,
                badge: "Am beliebtesten",
                sub: "Für wachsende Unternehmen",
                features: ["Volle Agent-Kette", "60 Runs / Monat", "1 Markt / Nische", "Priority Support"],
              },
              {
                name: "Scale", highlight: false,
                sub: "Für mehrere Märkte",
                features: ["Alle Agents + Bundle", "Unlimited Runs", "Mehrere Märkte", "Dedizierter Ansprechpartner"],
              },
            ].map(plan => (
              <div key={plan.name} style={{
                background: plan.highlight ? "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(139,92,246,0.1))" : "var(--bg-card)",
                border: `1px solid ${plan.highlight ? "var(--accent-border)" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)", padding: "32px 28px",
                position: "relative",
                boxShadow: plan.highlight ? "0 0 48px rgba(99,102,241,0.15)" : "none",
                transform: plan.highlight ? "scale(1.03)" : "none",
              }}>
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: "var(--accent)", color: "#fff",
                    fontSize: "0.7rem", fontWeight: 800, padding: "4px 14px",
                    borderRadius: 100, letterSpacing: "0.5px", whiteSpace: "nowrap",
                  }}>
                    ★ {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 24 }}>{plan.sub}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: plan.highlight ? "var(--accent-bright)" : "var(--text-primary)", marginBottom: 28, letterSpacing: "-1px" }}>
                  Auf Anfrage
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      <CheckCircle size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
                      {f}
                    </div>
                  ))}
                </div>
                <a href="#kontakt" className={`btn ${plan.highlight ? "btn-primary" : "btn-outline"} btn-full`} style={{ padding: "12px", justifyContent: "center" }}>
                  Anfragen
                </a>
              </div>
            ))}
          </div>

          <p className="reveal" style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Alle Preise auf Anfrage · Kein Setup-Fee · Monatlich kündbar · Alle Preise zzgl. MwSt.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ TRUST & USE CASE */}
      <section className="landing-section" style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
        <div className="section-inner">
          <div className="section-tag reveal">Vertrauen & Sicherheit</div>
          <h2 className="section-title reveal">
            Gemacht für den<br />deutschen Markt.
          </h2>
          <p className="section-sub reveal" style={{ marginBottom: 48 }}>
            Volle Transparenz, volle Kontrolle – und ein Use Case der bereits live im Einsatz ist.
          </p>

          {/* Trust Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 48 }}>
            {TRUST_CARDS.map(card => (
              <div key={card.title} className="reveal" style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: 24,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-glow)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-bright)", marginBottom: 14 }}>
                  {card.icon}
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: 8 }}>{card.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{card.desc}</div>
              </div>
            ))}
          </div>

          {/* Before / After */}
          <div className="reveal" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "rgba(248,113,113,0.06)", borderRight: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#F87171" }}>Vorher (ohne Agent)</div>
              </div>
              <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "rgba(52,211,153,0.06)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--success)" }}>Nachher (Agent im Einsatz)</div>
              </div>
            </div>
            {[
              ["Manuelle Marktrecherche wöchentlich", "Kontinuierliche Analyse – automatisch"],
              ["Freelancer für Ad-Creatives", "Creatives aus eigenen Assets"],
              ["Manuelles Hochladen & Testen", "Vollautomatische Veröffentlichung"],
              ["15h+ Marketing-Aufwand pro Woche", "0h Aufwand – Fokus auf das Business"],
              ["Abhängig von externen Dienstleistern", "Vollständig unabhängig & skalierbar"],
            ].map(([before, after], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: "14px 28px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  <span style={{ color: "#F87171", fontWeight: 700 }}>✕</span> {before}
                </div>
                <div style={{ padding: "14px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  <CheckCircle size={14} style={{ color: "var(--success)", flexShrink: 0 }} /> {after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ FAQ */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-tag reveal">Häufige Fragen</div>
          <h2 className="section-title reveal">
            Eure Fragen –<br />direkt beantwortet.
          </h2>

          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 12, maxWidth: 800 }}>
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="reveal" style={{
                background: "var(--bg-card)", border: `1px solid ${openFaq === i ? "var(--accent-border)" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)", overflow: "hidden",
                transition: "border-color 0.2s",
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", padding: "20px 24px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--text-primary)", fontFamily: "inherit",
                    fontSize: "0.95rem", fontWeight: 700, textAlign: "left", gap: 16,
                  }}
                >
                  {item.q}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, color: "var(--text-muted)", transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 20px", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.78 }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════ CTA */}
      <div className="cta-section" id="kontakt">
        <div className="cta-inner reveal">
          <h2 className="cta-title">
            Bereit für dein<br />
            <span className="cta-gradient">digitales Marketing-Team?</span>
          </h2>
          <p className="cta-sub">
            Buch dir jetzt einen kostenlosen Demo-Call und sieh live wie dein Agent
            deinen Markt analysiert, Creatives erstellt und Kampagnen schaltet –
            ohne deinen Aufwand.
          </p>
          <div className="cta-actions">
            <Link href="/sign-in" className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Kostenlosen Demo-Call buchen <ArrowRight size={16} />
            </Link>
            <a href="mailto:kontakt@kanaai.de" className="btn btn-outline" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Per E-Mail anfragen
            </a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ FOOTER */}
      <footer className="landing-footer">
        <div className="footer-logo">
          <span className="footer-dot" />
          KANA AI
        </div>
        <div className="footer-copy">© 2026 KANA AI. Alle Rechte vorbehalten.</div>
        <div className="footer-links">
          <a href="#">Impressum</a>
          <a href="#">Datenschutz</a>
          <a href="mailto:kontakt@kanaai.de">Kontakt</a>
        </div>
      </footer>
    </>
  );
}
