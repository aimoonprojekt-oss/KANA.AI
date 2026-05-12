"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search, Scissors, Send, Lightbulb, Gem, Plus, ArrowRight,
  CheckCircle, LayoutGrid, FileText, Inbox,
} from "lucide-react";

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRefs  = useRef<(HTMLSpanElement | null)[]>([]);
  const wordIdx   = useRef(0);

  /* ── Neural Network Canvas ── */
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    // Explicit cast so TypeScript keeps the type in inner closures
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let W = 0, H = 0;
    const NUM = 70, DIST = 160, SPEED = 0.4;
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let particles: P[] = [];

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
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
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(129,140,248,0.65)";
        ctx.fill();
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

  /* ── Word Cycling ── */
  useEffect(() => {
    const words = wordRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (words.length === 0) return;
    words[0].classList.add("active");
    const interval = setInterval(() => {
      const cur  = wordIdx.current;
      const next = (cur + 1) % words.length;
      words[cur].classList.remove("active");
      words[cur].classList.add("exit");
      setTimeout(() => words[cur].classList.remove("exit"), 500);
      words[next].classList.add("active");
      wordIdx.current = next;
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  /* ── Scroll Reveal ── */
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.transitionDelay = `${i * 0.08}s`;
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── Stats Counter ── */
  useEffect(() => {
    const bar = document.getElementById("statsBar");
    if (!bar) return;
    let triggered = false;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !triggered) {
        triggered = true;
        document.querySelectorAll<HTMLElement>(".stat-number[data-target]").forEach(el => {
          const target   = parseInt(el.dataset.target!);
          const suffix   = el.dataset.suffix ?? (target >= 100 ? "+" : "");
          const duration = 1600;
          const start    = performance.now();
          const step = (now: number) => {
            const t   = Math.min((now - start) / duration, 1);
            const val = Math.round((1 - Math.pow(1 - t, 3)) * target);
            el.textContent = val.toLocaleString("de-DE") + suffix;
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }
    }, { threshold: 0.3 });
    io.observe(bar);
    return () => io.disconnect();
  }, []);

  const WORDS = [
    "Unbegrenzt skalierbar.",
    "Sofort verfügbar.",
    "Immer einsatzbereit.",
    "Messbar effizienter.",
  ];

  return (
    <>
      {/* ── NAV ── */}
      <nav className="landing-nav">
        <a href="#" className="nav-logo">
          <span className="logo-dot" />
          KANA AI
        </a>
        <ul className="nav-links">
          <li><a href="#agents">Agenten</a></li>
          <li><a href="#how">Workflow</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
        </ul>
        <div className="nav-actions">
          <Link href="/sign-in" className="btn btn-ghost">Anmelden</Link>
          <Link href="/sign-in" className="btn btn-primary">
            Zugang anfragen <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <canvas ref={canvasRef} id="heroCanvas" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div>
            <div className="hero-badge">
              <span className="pulse" />
              Digitale Mitarbeiter — jetzt verfügbar
            </div>
            <h1 className="hero-title">
              Ihr Team.<br />
              <span className="word-cycle">
                {WORDS.map((w, i) => (
                  <span key={w} ref={el => { wordRefs.current[i] = el; }} className="word">
                    {w}
                  </span>
                ))}
                <span className="word-spacer" aria-hidden="true">Unbegrenzt skalierbar.</span>
              </span>
            </h1>
            <p className="hero-sub">
              KANA AI stellt Ihrem Unternehmen spezialisierte KI-Mitarbeiter zur Verfügung —
              on Demand, ohne Onboarding, sofort produktiv.
            </p>
            <div className="hero-actions">
              <Link href="/sign-in" className="btn btn-primary">
                Jetzt loslegen <ArrowRight size={15} />
              </Link>
              <a href="#agents" className="btn btn-outline">Agenten ansehen</a>
            </div>
          </div>

          {/* Floating Agent Preview Cards */}
          <div className="hero-visual">
            <div className="agent-cards-grid">
              {[
                { icon: <Search size={20} />,   name: "Research Agent",     dept: "Research"  },
                { icon: <Scissors size={20} />, name: "Video Cutter",       dept: "Content"   },
                { icon: <Send size={20} />,     name: "Cold Mailing",       dept: "Sales"     },
                { icon: <Lightbulb size={20}/>, name: "Creative Strategist",dept: "Marketing" },
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

      {/* ── STATS ── */}
      <div className="stats-bar" id="statsBar">
        <div className="stats-bar-inner">
          <div className="stat-item">
            <div className="stat-number" data-target="50">0</div>
            <div className="stat-label">Unternehmen vertrauen KANA</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" data-target="5">5</div>
            <div className="stat-label">Spezialisierte KI-Agenten</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" data-suffix=" / 7">24</div>
            <div className="stat-label">Immer einsatzbereit</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" data-target="1240">0</div>
            <div className="stat-label">Erledigte Aufgaben</div>
          </div>
        </div>
      </div>

      {/* ── AGENTS ── */}
      <section className="landing-section" id="agents">
        <div className="section-inner">
          <div className="section-tag reveal">Unsere Agenten</div>
          <h2 className="section-title reveal">Digitale Mitarbeiter.<br />Bereit für den Einsatz.</h2>
          <p className="section-sub reveal">
            Jeder Agent ist hochspezialisiert und liefert Ergebnisse auf Unternehmens-Niveau —
            ohne Briefing-Marathons.
          </p>

          <div className="agents-grid-landing">
            {[
              { icon: <Search size={22}/>,   tag: "Research",        name: "Research Agent",     desc: "Analysiert Märkte, Wettbewerber und Trends. Strukturierte Reports auf Knopfdruck — was früher Tage dauerte, jetzt in Minuten.", tasks: "1.240" },
              { icon: <Scissors size={22}/>, tag: "Content & Video",  name: "Video Cutter",       desc: "Schneidet, kürzt und optimiert Videoinhalte automatisch. Perfekt für Social Media, Ads und Content-Strategie.",              tasks: "876"   },
              { icon: <Send size={22}/>,     tag: "Sales",            name: "Cold Mailing Agent", desc: "Erstellt personalisierte Cold-Email-Sequenzen. Höhere Öffnungsraten durch KI-gestützte Personalisierung auf Zielgruppen-Ebene.", tasks: "3.450" },
              { icon: <Lightbulb size={22}/>,tag: "Marketing",        name: "Creative Strategist",desc: "Entwickelt Kampagnenstrategien, Content-Konzepte und Kommunikationsansätze — datenbasiert und zielgruppengerecht.",           tasks: "520"   },
              { icon: <Gem size={22}/>,      tag: "Brand",            name: "Brand Expert",       desc: "Analysiert Ihre Markenidentität und entwickelt konsistente Markenbotschaften für alle Kanäle — von Positionierung bis Tonalität.", tasks: "312" },
            ].map(agent => (
              <div key={agent.name} className="agent-card-full reveal">
                <div className="agent-full-icon">{agent.icon}</div>
                <div className="agent-full-tag">{agent.tag}</div>
                <div className="agent-full-name">{agent.name}</div>
                <div className="agent-full-desc">{agent.desc}</div>
                <div className="agent-full-footer">
                  <div className="agent-tasks">Abgeschlossen: <span>{agent.tasks} Aufgaben</span></div>
                  <span style={{ fontSize: ".72rem", color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle size={12} /> Verfügbar
                  </span>
                </div>
              </div>
            ))}

            {/* Coming Soon */}
            <div className="agent-card-full reveal" style={{ borderStyle: "dashed", background: "rgba(99,102,241,0.02)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 200, cursor: "default" }}>
              <Plus size={28} style={{ color: "var(--text-muted)", marginBottom: 14 }} />
              <div className="agent-full-name" style={{ opacity: 0.6 }}>Mehr kommen bald</div>
              <div className="agent-full-desc" style={{ marginTop: 8, fontSize: ".8rem", maxWidth: 200 }}>
                Procurement, Operations und weitere Spezialisten
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="landing-section" id="how" style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
        <div className="section-inner">
          <div className="section-tag reveal">Workflow</div>
          <h2 className="section-title reveal">In drei Schritten<br />zum Ergebnis.</h2>
          <p className="section-sub reveal">Kein kompliziertes Setup. Kein langes Onboarding. Einfach Auftrag erteilen — fertig.</p>
          <div className="how-steps">
            {[
              { n: "01", icon: <LayoutGrid size={18} />, title: "Agent auswählen",  desc: "Wählen Sie den passenden digitalen Mitarbeiter aus Ihrem Portfolio spezialisierter KI-Agenten." },
              { n: "02", icon: <FileText size={18} />,   title: "Auftrag erteilen", desc: "Beschreiben Sie Ihre Anforderung in einfacher Sprache. Kein Programmieren — nur Ihr Auftrag." },
              { n: "03", icon: <Inbox size={18} />,      title: "Ergebnis erhalten",desc: "Der Agent liefert das fertige Ergebnis direkt in Ihr Dashboard oder per E-Mail — einsatzbereit." },
            ].map(step => (
              <div key={step.n} className="step-card reveal">
                <div className="step-number">{step.n}</div>
                <div className="step-icon">{step.icon}</div>
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="cta-section" id="kontakt">
        <div className="cta-inner reveal">
          <h2 className="cta-title">
            Bereit für Ihr<br />
            <span className="cta-gradient">digitales Team?</span>
          </h2>
          <p className="cta-sub">
            Starten Sie noch heute und erleben Sie, wie KANA AI Ihre Prozesse transformiert —
            von E-Commerce bis Konzern.
          </p>
          <div className="cta-actions">
            <Link href="/sign-in" className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Jetzt starten <ArrowRight size={16} />
            </Link>
            <a href="mailto:kontakt@kanaai.de" className="btn btn-outline" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Kontakt aufnehmen
            </a>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div className="footer-logo">
          <span className="footer-dot" />
          KANA AI
        </div>
        <div className="footer-copy">© 2025 KANA AI. Alle Rechte vorbehalten.</div>
        <div className="footer-links">
          <a href="#">Impressum</a>
          <a href="#">Datenschutz</a>
          <a href="#">Kontakt</a>
        </div>
      </footer>
    </>
  );
}
