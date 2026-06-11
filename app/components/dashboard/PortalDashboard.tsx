"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, Megaphone, Briefcase, Package, Settings2,
  ShoppingCart, Clock, SlidersHorizontal, LogOut,
  Play, Lock, CreditCard, Activity, Plus, X,
  Search, Scissors, Send, Lightbulb, Gem, BarChart2,
  TrendingUp, TrendingDown, Zap, Calendar, CheckCircle,
  ArrowRight,
} from "lucide-react";
import type { DBAgent, UsageOverview } from "@/lib/platform/supabase";

/* ─── Konstanten ─────────────────────────────────────── */
const MONTHLY_LIMIT = 50;
const SUPPORT_EMAIL = "support@kanaai.de";

/* ─── Types ──────────────────────────────────────────── */
type View = "agents" | "history" | "billing";
type Dept = "all" | "marketing" | "sales" | "procurement" | "operations" | "research";

type BillingSubscription = {
  id: string;
  status: string;
  planName: string;
  priceEur: number;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

interface TriggerState {
  agentId:   string;
  agentName: string;
  agentDept: string;
  icon:      React.ReactNode;
}

interface Props {
  userAgents:    DBAgent[];
  lockedAgents:  DBAgent[];
  userName:      string;
  userInitials:  string;
  userEmail:     string;
  usage:         UsageOverview;
  purchasedSlug?: string;
  isAdmin?:       boolean;
}

const DEPT_LABELS: Record<Dept, string> = {
  all: "Alle Agenten", marketing: "Marketing", sales: "Sales",
  procurement: "Procurement", operations: "Operations", research: "Research",
};

/* ─── Helfer ─────────────────────────────────────────── */
function getDept(agent: DBAgent): Dept {
  const cat = (agent.category ?? "").toLowerCase();
  const n   = agent.name.toLowerCase();
  if (cat === "research"    || n.includes("research"))                                           return "research";
  if (cat === "sales"       || n.includes("sales")  || n.includes("mail") || n.includes("cold")) return "sales";
  if (cat === "marketing"   || n.includes("market") || n.includes("creative") || n.includes("brand") || n.includes("video")) return "marketing";
  if (cat === "procurement" || n.includes("procure") || n.includes("einkauf"))                   return "procurement";
  if (cat === "operations"  || n.includes("operations"))                                         return "operations";
  return "all";
}

function getIcon(name: string, category: string | null = null): React.ReactNode {
  const n = (name + " " + (category ?? "")).toLowerCase();
  if (n.includes("research"))                                               return <Search size={22} />;
  if (n.includes("cold") || n.includes("mail") || n.includes("sales"))     return <Send size={22} />;
  if (n.includes("creative") || n.includes("strateg"))                     return <Lightbulb size={22} />;
  if (n.includes("brand"))                                                  return <Gem size={22} />;
  if (n.includes("video") || n.includes("cut"))                            return <Scissors size={22} />;
  if (n.includes("market") || n.includes("ad") || n.includes("campaign"))  return <Megaphone size={22} />;
  return <LayoutGrid size={22} />;
}

function getTag(agent: DBAgent): string {
  if (agent.category) return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  const n = agent.name.toLowerCase();
  if (n.includes("research"))              return "Research";
  if (n.includes("cold") || n.includes("mail")) return "Sales";
  if (n.includes("creative"))             return "Marketing";
  if (n.includes("brand"))                return "Brand";
  if (n.includes("video"))                return "Content & Video";
  return "KI-Agent";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function fmtEur(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });
}

/* ═══════════════════════════════════════════════════════ */

export default function PortalDashboard({
  userAgents, lockedAgents, userName, userInitials, userEmail, usage, purchasedSlug, isAdmin,
}: Props) {
  const router = useRouter();

  /* ── View & Filter ── */
  const [view, setView]             = useState<View>("agents");
  const [activeDept, setActiveDept] = useState<Dept>("all");

  /* ── Trigger Modal ── */
  const [trigger, setTrigger]     = useState<TriggerState | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [inputError, setInputError] = useState(false);

  /* ── Sync ── */
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<string | null>(null);

  /* ── Checkout ── */
  const [buyingId, setBuyingId]         = useState<string | null>(null);
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(!!purchasedSlug);

  /* ── Onboarding ── */
  const [showOnboarding, setShowOnboarding] = useState(false);

  /* ── Billing ── */
  const [subscriptions, setSubscriptions]   = useState<BillingSubscription[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading]   = useState(false);

  /* ── Derived ── */
  const firstName      = userName.split(" ")[0];
  const usedThisMonth  = usage.totalThisMonth;
  const remaining      = Math.max(0, MONTHLY_LIMIT - usedThisMonth);
  const usedPct        = Math.min(100, Math.round((usedThisMonth / MONTHLY_LIMIT) * 100));

  const deptCounts: Record<string, number> = {};
  userAgents.forEach(a => {
    const d = getDept(a);
    if (d !== "all") deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  });

  const visibleAgents = activeDept === "all"
    ? userAgents
    : userAgents.filter(a => getDept(a) === activeDept);

  const visibleLocked = lockedAgents.filter(a =>
    activeDept === "all" || getDept(a) === activeDept
  );

  /* ── Billing total ── */
  const totalMonthly = subscriptions.reduce((s, sub) => s + sub.priceEur, 0);
  const estimatedCost = totalMonthly > 0
    ? (usedThisMonth / MONTHLY_LIMIT) * totalMonthly
    : null;

  /* ── Effects ── */

  // Onboarding: einmal beim ersten Login zeigen
  useEffect(() => {
    const done = localStorage.getItem("kana_onboarding_done");
    if (!done && userAgents.length === 0) {
      setShowOnboarding(true);
    }
  }, [userAgents.length]);

  // Purchase-success Banner nach 6s ausblenden
  useEffect(() => {
    if (!showPurchaseSuccess) return;
    const t = setTimeout(() => setShowPurchaseSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [showPurchaseSuccess]);

  // Billing-Daten laden wenn Tab geöffnet wird
  useEffect(() => {
    if (view !== "billing" || subscriptions.length > 0) return;
    setBillingLoading(true);
    fetch("/api/billing/info")
      .then(r => r.json())
      .then(d => setSubscriptions(d.subscriptions ?? []))
      .catch(() => setSubscriptions([]))
      .finally(() => setBillingLoading(false));
  }, [view, subscriptions.length]);

  /* ── Handlers ── */
  function openTrigger(agent: DBAgent) {
    setTaskInput(""); setInputError(false);
    setTrigger({
      agentId:   agent.anthropic_agent_id,
      agentName: agent.name,
      agentDept: getTag(agent),
      icon:      getIcon(agent.name, agent.category),
    });
  }

  function startAgent() {
    if (!taskInput.trim()) { setInputError(true); return; }
    if (!trigger) return;
    router.push(`/chat/${trigger.agentId}?task=${encodeURIComponent(taskInput.trim())}`);
  }

  async function buyAgent(agent: DBAgent) {
    if (buyingId) return;
    setBuyingId(agent.anthropic_agent_id);
    try {
      const res  = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicAgentId: agent.anthropic_agent_id }),
      });
      const json = await res.json();
      if (res.ok && json.url) { window.location.href = json.url; }
      else { alert(`Checkout fehlgeschlagen: ${json.error ?? "Unbekannter Fehler"}`); setBuyingId(null); }
    } catch (e) {
      alert(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
      setBuyingId(null);
    }
  }

  async function syncAgents() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res  = await fetch("/api/admin/sync-agents", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const count    = json.synced?.length ?? 0;
        const errCount = json.errors?.length ?? 0;
        setSyncMsg(`✓ ${count} Agent(en) importiert${errCount > 0 ? ` (${errCount} Fehler)` : ""}`);
        if (count > 0) setTimeout(() => window.location.reload(), 1800);
      } else {
        setSyncMsg(`✗ ${json.message}`);
      }
    } catch (e) {
      setSyncMsg(`✗ Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.url) { window.location.href = json.url; }
      else { alert(json.error ?? "Portal nicht verfügbar"); }
    } catch {
      alert("Netzwerkfehler");
    } finally {
      setPortalLoading(false);
    }
  }

  function dismissOnboarding() {
    localStorage.setItem("kana_onboarding_done", "1");
    setShowOnboarding(false);
  }

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="portal-wrapper">

      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar">
        <div className="sidebar-logo-bar">
          <div className="sidebar-logo">
            <span style={{ width: 8, height: 8, background: "var(--accent)", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 12px var(--accent)" }} />
            KANA AI
          </div>
          {/* System-Status Chip */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", fontWeight: 700, color: "var(--success)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", animation: "pulseDot 2s infinite" }} />
            Live
          </div>
        </div>

        {/* User */}
        <div className="sidebar-user-section">
          <div className="sidebar-user">
            <div className="user-avatar">{userInitials}</div>
            <div style={{ overflow: "hidden" }}>
              <div className="user-name">{userName}</div>
              <div className="user-email" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-title">Übersicht</span>
          <button className={`sidebar-item ${view === "agents" && activeDept === "all" ? "active" : ""}`}
            onClick={() => { setView("agents"); setActiveDept("all"); }}>
            <span className="item-icon"><LayoutGrid size={16} /></span>
            Alle Agenten
            <span className="item-count">{userAgents.length}</span>
          </button>

          <span className="sidebar-section-title">Abteilungen</span>
          {(["marketing", "sales", "procurement", "operations"] as Dept[]).map(dept => (
            <button key={dept}
              className={`sidebar-item ${view === "agents" && activeDept === dept ? "active" : ""}`}
              onClick={() => { setView("agents"); setActiveDept(dept); }}>
              <span className="item-icon">
                {dept === "marketing"   && <Megaphone size={16} />}
                {dept === "sales"       && <Briefcase size={16} />}
                {dept === "procurement" && <Package size={16} />}
                {dept === "operations"  && <Settings2 size={16} />}
              </span>
              {DEPT_LABELS[dept]}
              {(deptCounts[dept] ?? 0) > 0 && <span className="item-count">{deptCounts[dept]}</span>}
            </button>
          ))}

          <span className="sidebar-section-title" style={{ marginTop: 28 }}>Konto</span>
          <button className="sidebar-item" onClick={() => setView("agents")}>
            <span className="item-icon"><ShoppingCart size={16} /></span>
            Weitere Agenten
          </button>
          <button className={`sidebar-item ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}>
            <span className="item-icon"><Clock size={16} /></span>
            Verlauf & Nutzung
            {usage.totalThisMonth > 0 && <span className="item-count">{usage.totalThisMonth}</span>}
          </button>
          <button className={`sidebar-item ${view === "billing" ? "active" : ""}`}
            onClick={() => setView("billing")}>
            <span className="item-icon"><CreditCard size={16} /></span>
            Abo & Kosten
          </button>
          <button className="sidebar-item">
            <span className="item-icon"><SlidersHorizontal size={16} /></span>
            Einstellungen
          </button>

          {/* Support */}
          <span className="sidebar-section-title" style={{ marginTop: 28 }}>Hilfe</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="sidebar-item" style={{ textDecoration: "none" }}>
            <span className="item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </span>
            Support kontaktieren
          </a>

          {isAdmin && (
            <>
              <span className="sidebar-section-title" style={{ marginTop: 28 }}>Admin</span>
              <a href="/admin" className="sidebar-item" style={{ textDecoration: "none" }}>
                <span className="item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>
                </span>
                Agent-Verwaltung
              </a>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <SignOutButton redirectUrl="/">
            <button className="sidebar-logout" type="button">
              <LogOut size={16} /> Abmelden
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main className="portal-main">

        {/* Topbar */}
        <div className="portal-topbar">
          <div className="portal-page-title">
            <span className="breadcrumb">KANA AI</span>
            <span className="breadcrumb-sep"> / </span>
            <span>{view === "history" ? "Verlauf & Nutzung" : view === "billing" ? "Abo & Kosten" : DEPT_LABELS[activeDept]}</span>
          </div>
          <div className="topbar-actions">
            {syncMsg && (
              <span style={{ fontSize: "0.78rem", color: syncMsg.startsWith("✓") ? "var(--success)" : "#F87171", fontWeight: 600 }}>
                {syncMsg}
              </span>
            )}
            <button className="btn btn-outline btn-sm" onClick={syncAgents} disabled={syncing}>
              {syncing ? "Sync läuft…" : "⟳ Sync aus Console"}
            </button>
            {view === "agents" && (
              <button className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Agent hinzufügen
              </button>
            )}
          </div>
        </div>

        <div className="portal-content">

          {/* ── Kauf-Erfolgsmeldung ── */}
          {showPurchaseSuccess && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between",
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)",
              borderRadius: "var(--radius-lg)", padding: "16px 20px", marginBottom: 24,
              animation: "card-fadein 0.4s ease both",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={20} style={{ color: "var(--success)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                    Agent erfolgreich freigeschaltet!
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Euer Agent ist einsatzbereit. Viel Erfolg mit eurem Marketing.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowPurchaseSuccess(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              AGENTS VIEW
          ══════════════════════════════════════════════ */}
          {view === "agents" && (
            <>
              {/* Welcome Banner */}
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2>Guten Tag, {firstName} 👋</h2>
                  <p>
                    {userAgents.length > 0
                      ? `${userAgents.length} aktive${userAgents.length === 1 ? "r" : ""} Agent${userAgents.length === 1 ? "" : "en"} — bereit für den nächsten Auftrag.`
                      : "Willkommen bei KANA AI. Kaufe deinen ersten Agenten um loszulegen."}
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={14} /> Aktivitäten
                </button>
              </div>

              {/* Stats Row */}
              <div className="stats-row">
                {[
                  {
                    label: "Aktive Agenten",
                    val: String(userAgents.length),
                    change: userAgents.length > 0 ? "Einsatzbereit" : "Noch keine Agenten",
                    changeColor: userAgents.length > 0 ? "var(--success)" : "var(--text-muted)",
                  },
                  {
                    label: "Sessions diesen Monat",
                    val: `${usedThisMonth} / ${MONTHLY_LIMIT}`,
                    change: `${remaining} Sessions verbleibend`,
                    changeColor: remaining < 10 ? "#F87171" : "var(--success)",
                  },
                  {
                    label: "Verbrauch diesen Monat",
                    val: estimatedCost !== null ? fmtEur(estimatedCost) : `${usedPct}%`,
                    change: totalMonthly > 0
                      ? `von ${fmtEur(totalMonthly)} / Monat`
                      : "Abo-Daten laden…",
                    changeColor: "var(--text-muted)",
                  },
                ].map((s, i) => (
                  <div key={s.label} className="stat-card" style={{ animation: `card-fadein 0.5s ${i * 0.1}s ease both` }}>
                    <div className="stat-label-small">{s.label}</div>
                    <div className="stat-val" style={{ fontSize: s.label === "Sessions diesen Monat" ? "1.4rem" : undefined }}>{s.val}</div>
                    <div className="stat-change" style={{ color: s.changeColor }}>{s.change}</div>
                  </div>
                ))}
              </div>

              {/* Agents Header */}
              <div className="portal-section-header">
                <div className="portal-section-title">
                  {activeDept === "all" ? "Ihre Agenten" : `${DEPT_LABELS[activeDept]} Agenten`}
                </div>
              </div>

              {/* Leerer Zustand — neue Kunden */}
              {userAgents.length === 0 && visibleLocked.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "60px 20px",
                  background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  animation: "card-fadein 0.5s ease both",
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                  <h3 style={{ fontWeight: 800, marginBottom: 8, fontSize: "1.2rem" }}>
                    Bereit für deinen ersten KI-Agenten?
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 420, margin: "0 auto 28px" }}>
                    Dein Agent übernimmt Marktanalyse, Creative-Produktion und Kampagnenmanagement —
                    vollautomatisch, rund um die Uhr.
                  </p>
                  <a href="#" className="btn btn-primary" style={{ padding: "12px 28px" }}>
                    Ersten Agenten anfragen <ArrowRight size={15} />
                  </a>
                </div>
              ) : (
                <div className="portal-agents-grid">
                  {/* Freigeschaltete Agents */}
                  {visibleAgents.map((agent, i) => (
                    <div key={agent.id} className="portal-agent-card"
                      style={{ animation: `card-fadein 0.5s ${i * 0.08}s ease both` }}>
                      <div className="portal-agent-icon">{getIcon(agent.name, agent.category)}</div>
                      <div className="portal-agent-tag">{getTag(agent)}</div>
                      <div className="portal-agent-name">{agent.name}</div>
                      <div className="portal-agent-desc">{agent.description ?? ""}</div>
                      <div className="portal-agent-footer">
                        <button className="btn-trigger-portal" onClick={() => openTrigger(agent)}>
                          <Play size={13} /> Starten
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Gesperrte Agents */}
                  {visibleLocked.map((agent, i) => (
                    <div key={agent.id} className="portal-agent-card locked"
                      style={{ animation: `card-fadein 0.5s ${(visibleAgents.length + i) * 0.08}s ease both` }}>
                      <div className="lock-badge"><Lock size={11} /> Gesperrt</div>
                      <div className="portal-agent-icon" style={{ opacity: 0.45 }}>{getIcon(agent.name, agent.category)}</div>
                      <div className="portal-agent-tag">{getTag(agent)}</div>
                      <div className="portal-agent-name">{agent.name}</div>
                      <div className="portal-agent-desc">{agent.description ?? ""}</div>
                      <div className="portal-agent-footer">
                        <button className="btn-buy" onClick={() => buyAgent(agent)}
                          disabled={buyingId === agent.anthropic_agent_id}>
                          <CreditCard size={13} />
                          {buyingId === agent.anthropic_agent_id ? "Weiterleitung…" : `Ab €${agent.price_eur}/Monat`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════
              HISTORY VIEW
          ══════════════════════════════════════════════ */}
          {view === "history" && (
            <>
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Zap size={20} style={{ color: "var(--accent-bright)" }} /> Nutzungsübersicht
                  </h2>
                  <p>Alle Aufrufe und Sessions Ihres Accounts im Überblick.</p>
                </div>
              </div>

              {/* Limit Card */}
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "24px 28px", marginBottom: 28,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-muted)", marginBottom: 4 }}>
                      Monatliches Session-Limit
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-1px" }}>
                      {usedThisMonth}{" "}
                      <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {MONTHLY_LIMIT} Sessions</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>Verbleibend</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: remaining > 10 ? "var(--success)" : "#F87171" }}>
                      {remaining}
                    </div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 999, width: `${usedPct}%`,
                    background: usedPct > 80
                      ? "linear-gradient(90deg,#F87171,#ef4444)"
                      : "linear-gradient(90deg,var(--accent),var(--accent-light))",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  <span>{usedPct}% verbraucht</span>
                  <span>Reset am 1. des nächsten Monats</span>
                </div>
              </div>

              {/* Woche-Karten */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
                {[
                  { label: "Diese Woche", val: usage.stats.reduce((s, a) => s + a.sessionsThisWeek, 0), muted: false },
                  { label: "Letzte Woche", val: usage.stats.reduce((s, a) => s + a.sessionsLastWeek, 0), muted: true },
                ].map(w => (
                  <div key={w.label} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: w.muted ? "rgba(180,180,200,0.08)" : "var(--accent-glow)",
                      border: `1px solid ${w.muted ? "var(--border)" : "var(--accent-border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: w.muted ? "var(--text-muted)" : "var(--accent-bright)",
                    }}>
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="stat-label-small">{w.label}</div>
                      <div className="stat-val" style={{ fontSize: "1.6rem" }}>{w.val}</div>
                      <div className="stat-change" style={{ color: w.muted ? "var(--text-muted)" : "var(--success)" }}>Sessions gestartet</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro-Agent Breakdown */}
              {usage.stats.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px 28px", marginBottom: 28 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart2 size={16} style={{ color: "var(--accent-bright)" }} /> Nutzung pro Agent
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {usage.stats.map(stat => {
                      const pct     = Math.min(100, Math.round((stat.totalSessions / Math.max(1, usage.totalThisMonth)) * 100));
                      const weekDiff = stat.sessionsThisWeek - stat.sessionsLastWeek;
                      return (
                        <div key={stat.agentId}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-glow)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-bright)" }}>
                                <Search size={14} />
                              </div>
                              <div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{stat.agentName}</div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Diese Woche: {stat.sessionsThisWeek} · Letzte Woche: {stat.sessionsLastWeek}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {weekDiff > 0 && <span style={{ fontSize: "0.72rem", color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><TrendingUp size={12} />+{weekDiff}</span>}
                              {weekDiff < 0 && <span style={{ fontSize: "0.72rem", color: "#F87171", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><TrendingDown size={12} />{weekDiff}</span>}
                              <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>{stat.totalSessions}</span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>gesamt</span>
                            </div>
                          </div>
                          <div style={{ background: "var(--bg-secondary)", borderRadius: 999, height: 5, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-light))", transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Letzte Sessions */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px 28px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={16} style={{ color: "var(--accent-bright)" }} /> Letzte Aktivitäten
                </div>
                {usage.recentSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    Noch keine Sessions gestartet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {usage.recentSessions.map((session, i) => (
                      <div key={session.id}
                        onClick={() => router.push(`/chat/${session.agent_id}?session=${session.anthropic_session_id}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "10px 12px", borderRadius: 8,
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                          cursor: "pointer", transition: "background 0.15s ease",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)")}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>{session.agentName}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Session fortsetzen →</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{fmtDate(session.created_at)}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{fmtTime(session.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════
              BILLING VIEW
          ══════════════════════════════════════════════ */}
          {view === "billing" && (
            <>
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CreditCard size={20} style={{ color: "var(--accent-bright)" }} /> Abo & Kosten
                  </h2>
                  <p>Transparente Übersicht über euren Plan, Verbrauch und Zahlungen.</p>
                </div>
                <button className="btn btn-primary btn-sm"
                  onClick={openBillingPortal} disabled={portalLoading}
                  style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {portalLoading ? "Öffne Portal…" : "Abo & Rechnungen verwalten →"}
                </button>
              </div>

              {billingLoading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                  <div className="spinner" style={{ margin: "0 auto 16px" }} />
                  Lade Abo-Daten…
                </div>
              ) : subscriptions.length === 0 ? (
                /* Kein Abo gefunden */
                <div style={{
                  textAlign: "center", padding: "60px 20px",
                  background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)", animation: "card-fadein 0.5s ease both",
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
                  <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Kein aktives Abo gefunden</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 24, maxWidth: 380, margin: "0 auto 24px" }}>
                    Sobald ihr einen Agenten gekauft habt, erscheinen hier eure Abo-Details, Zahlungsdaten und Rechnungen.
                  </p>
                  <button className="btn btn-outline" onClick={() => setView("agents")}>
                    Agenten ansehen
                  </button>
                </div>
              ) : (
                <>
                  {/* Abo-Karten */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
                    {subscriptions.map(sub => (
                      <div key={sub.id} style={{
                        background: "var(--bg-card)", border: "1px solid var(--accent-border)",
                        borderRadius: "var(--radius-lg)", padding: "28px",
                        animation: "card-fadein 0.5s ease both",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent-bright)" }}>
                            Aktives Abo
                          </div>
                          <div style={{
                            fontSize: "0.65rem", fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                            background: sub.cancelAtPeriodEnd ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)",
                            color: sub.cancelAtPeriodEnd ? "#F87171" : "var(--success)",
                            border: `1px solid ${sub.cancelAtPeriodEnd ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
                          }}>
                            {sub.cancelAtPeriodEnd ? "Endet bald" : "Aktiv"}
                          </div>
                        </div>

                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>{sub.planName}</div>
                        <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "var(--accent-bright)", letterSpacing: "-1.5px", marginBottom: 20 }}>
                          {fmtEur(sub.priceEur)}
                          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-muted)" }}> /{sub.interval === "month" ? "Monat" : "Jahr"}</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                          {[
                            { label: "Aktueller Zeitraum", val: `${fmtDate(sub.currentPeriodStart)} – ${fmtDate(sub.currentPeriodEnd)}` },
                            { label: "Nächste Zahlung", val: sub.cancelAtPeriodEnd ? "Keine (endet am " + fmtDate(sub.currentPeriodEnd) + ")" : fmtDate(sub.currentPeriodEnd) },
                          ].map(row => (
                            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{row.label}</span>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, textAlign: "right" }}>{row.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Verbrauchs-Übersicht */}
                  <div style={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)", padding: "28px", marginBottom: 24,
                    animation: "card-fadein 0.5s 0.1s ease both",
                  }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                      <Activity size={16} style={{ color: "var(--accent-bright)" }} /> Verbrauch diesen Monat
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }}>
                      {[
                        { label: "Sessions genutzt", val: String(usedThisMonth), sub: `von ${MONTHLY_LIMIT} inkludierten` },
                        { label: "Noch verfügbar", val: String(remaining), sub: "Sessions diesen Monat" },
                        { label: "Geschätzte Kosten", val: estimatedCost !== null ? fmtEur(estimatedCost) : "—", sub: totalMonthly > 0 ? `anteilig von ${fmtEur(totalMonthly)}` : "Fixpreis / Monat" },
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-1px", color: "var(--text-primary)", marginBottom: 3 }}>{s.val}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Fortschrittsbalken */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>
                        <span>{usedPct}% der inkludierten Sessions verbraucht</span>
                        <span>{usedThisMonth} / {MONTHLY_LIMIT}</span>
                      </div>
                      <div style={{ background: "var(--bg-secondary)", borderRadius: 999, height: 10, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999, width: `${usedPct}%`,
                          background: usedPct > 80
                            ? "linear-gradient(90deg,#F87171,#ef4444)"
                            : "linear-gradient(90deg,var(--accent),var(--accent-light))",
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                      {usedPct > 80 && (
                        <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#F87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          Ihr Limit wird bald erreicht — kontaktiert uns für ein Upgrade.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hinweis-Box */}
                  <div style={{
                    background: "rgba(99,102,241,0.06)", border: "1px solid var(--accent-border)",
                    borderRadius: "var(--radius-lg)", padding: "20px 24px",
                    display: "flex", alignItems: "flex-start", gap: 14,
                    animation: "card-fadein 0.5s 0.2s ease both",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Transparenz bei euren Kosten</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                        Euer Abo ist ein Festpreis — ihr zahlt jeden Monat {subscriptions[0] ? fmtEur(subscriptions[0].priceEur) : "den vereinbarten Betrag"}, unabhängig von der Nutzung.
                        Die Sessions-Anzeige zeigt euch wie viel ihr von eurem inkludierten Kontingent nutzt.
                        Bei Fragen zu eurer Rechnung:{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--accent-bright)", fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ══ TRIGGER MODAL ══ */}
      {trigger && (
        <div className="trigger-modal"
          onClick={e => { if (e.target === e.currentTarget) setTrigger(null); }}>
          <div className="trigger-modal-content">
            <div className="trigger-modal-header">
              <div>
                <div className="trigger-modal-icon">{trigger.icon}</div>
                <div className="trigger-modal-title">{trigger.agentName}</div>
                <div className="trigger-modal-sub">{trigger.agentDept} — Neuen Auftrag starten</div>
              </div>
              <button className="modal-close-btn" onClick={() => setTrigger(null)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Ihre Aufgabe *</label>
              <textarea className="form-textarea"
                value={taskInput}
                onChange={e => { setTaskInput(e.target.value); setInputError(false); }}
                placeholder="Beschreiben Sie Ihren Auftrag — z.B. 'Analysiere unsere Konkurrenz auf Instagram und erstelle 3 Ad-Ideen'"
                rows={4}
                style={inputError ? { borderColor: "#F87171" } : {}}
              />
              {inputError && <div style={{ fontSize: "0.75rem", color: "#F87171", marginTop: 6 }}>Bitte beschreibe deinen Auftrag.</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Kontext / Zusatzinfos (optional)</label>
              <textarea className="form-textarea" placeholder="Zielgruppe, Tonalität, besondere Anforderungen…" style={{ minHeight: 72 }} />
            </div>
            <button className="btn btn-primary btn-full"
              style={{ padding: "13px", fontSize: ".95rem", marginTop: 18 }}
              onClick={startAgent}>
              Agent starten <Play size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══ ONBOARDING MODAL ══ */}
      {showOnboarding && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(6,10,19,0.92)",
          backdropFilter: "blur(20px)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)", padding: "48px 40px",
            maxWidth: 620, width: "100%", position: "relative",
            animation: "scaleIn 0.3s ease both",
            boxShadow: "0 48px 128px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.15)",
          }}>
            <button onClick={dismissOnboarding}
              style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={20} />
            </button>

            {/* Logo + Begrüßung */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 0 40px rgba(99,102,241,0.5)" }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>K</span>
              </div>
              <h2 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-1px", marginBottom: 8 }}>
                Willkommen bei KANA AI
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>
                Euer KI-Marketing-Agent ist bereit. Hier ist was er für euch tun wird:
              </p>
            </div>

            {/* 3 Feature-Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
              {[
                { icon: <Search size={20} />, title: "Markt analysieren", desc: "Trends, Wettbewerber und Chancen — rund um die Uhr." },
                { icon: <Lightbulb size={20} />, title: "Creatives erstellen", desc: "Ads und Inhalte aus euren bestehenden Assets." },
                { icon: <Send size={20} />, title: "Kampagnen schalten", desc: "Automatisch auf den richtigen Kanälen veröffentlicht." },
              ].map(f => (
                <div key={f.title} style={{
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "20px 16px", textAlign: "center",
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-glow)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-bright)", margin: "0 auto 12px" }}>
                    {f.icon}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text-primary)", marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <button className="btn btn-primary btn-full"
              onClick={dismissOnboarding}
              style={{ padding: "14px", fontSize: "1rem" }}>
              Dashboard öffnen <ArrowRight size={16} />
            </button>
            <p style={{ textAlign: "center", fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 14 }}>
              Bei Fragen: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--accent-bright)" }}>{SUPPORT_EMAIL}</a>
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
