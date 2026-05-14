"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, Megaphone, Briefcase, Package, Settings2,
  ShoppingCart, Clock, SlidersHorizontal, LogOut,
  Play, Lock, CreditCard, Activity, Plus, X,
  Search, Scissors, Send, Lightbulb, Gem, BarChart2,
  TrendingUp, TrendingDown, Zap, Calendar,
} from "lucide-react";
import type { DBAgent, UsageOverview } from "@/lib/supabase";

/* ── Monatliches Session-Limit ── */
const MONTHLY_LIMIT = 50;

/* ── View / Dept types ── */
type View = "agents" | "history";
type Dept = "all" | "marketing" | "sales" | "procurement" | "operations" | "research";

interface TriggerState {
  agentId:   string;
  agentName: string;
  agentDept: string;
  icon:      React.ReactNode;
}

interface Props {
  userAgents:   DBAgent[];      // Agents, auf die der User Zugang hat
  lockedAgents: DBAgent[];      // Published Agents, die der User noch nicht gekauft hat
  userName:     string;
  userInitials: string;
  userEmail:    string;
  usage:        UsageOverview;
}

const DEPT_LABELS: Record<Dept, string> = {
  all: "Alle Agenten", marketing: "Marketing", sales: "Sales",
  procurement: "Procurement", operations: "Operations", research: "Research",
};

/* ── Hilfsfunktionen (arbeiten mit DBAgent-Feldern) ── */
function getDept(agent: DBAgent): Dept {
  const cat = (agent.category ?? "").toLowerCase();
  const n   = agent.name.toLowerCase();
  if (cat === "research"    || n.includes("research"))                                       return "research";
  if (cat === "sales"       || n.includes("sales") || n.includes("mail") || n.includes("cold")) return "sales";
  if (cat === "marketing"   || n.includes("market") || n.includes("creative") || n.includes("brand") || n.includes("video")) return "marketing";
  if (cat === "procurement" || n.includes("procure") || n.includes("einkauf"))               return "procurement";
  if (cat === "operations"  || n.includes("operations"))                                     return "operations";
  return "all";
}

function getIcon(name: string, category: string | null = null): React.ReactNode {
  const n = (name + " " + (category ?? "")).toLowerCase();
  if (n.includes("research"))                         return <Search size={22} />;
  if (n.includes("cold") || n.includes("mail") || n.includes("sales")) return <Send size={22} />;
  if (n.includes("creative") || n.includes("strateg"))                 return <Lightbulb size={22} />;
  if (n.includes("brand"))                            return <Gem size={22} />;
  if (n.includes("video") || n.includes("cut"))       return <Scissors size={22} />;
  return <LayoutGrid size={22} />;
}

function getTag(agent: DBAgent): string {
  if (agent.category) return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  const n = agent.name.toLowerCase();
  if (n.includes("research"))                         return "Research";
  if (n.includes("cold") || n.includes("mail"))       return "Sales";
  if (n.includes("creative"))                         return "Marketing";
  if (n.includes("brand"))                            return "Brand";
  if (n.includes("video"))                            return "Content & Video";
  return "KI-Agent";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function PortalDashboard({
  userAgents, lockedAgents, userName, userInitials, userEmail, usage,
}: Props) {
  const router = useRouter();
  const [view, setView]               = useState<View>("agents");
  const [activeDept, setActiveDept]   = useState<Dept>("all");
  const [trigger, setTrigger]         = useState<TriggerState | null>(null);
  const [taskInput, setTaskInput]     = useState("");
  const [inputError, setInputError]   = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [syncMsg, setSyncMsg]         = useState<string | null>(null);
  const [buyingId, setBuyingId]       = useState<string | null>(null);

  const firstName    = userName.split(" ")[0];
  const usedThisMonth = usage.totalThisMonth;
  const remaining     = Math.max(0, MONTHLY_LIMIT - usedThisMonth);
  const usedPct       = Math.min(100, Math.round((usedThisMonth / MONTHLY_LIMIT) * 100));

  /* Dept-Zähler für Sidebar-Badges */
  const deptCounts: Record<string, number> = {};
  userAgents.forEach(a => {
    const d = getDept(a);
    if (d !== "all") deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  });

  /* Gefilterte Agenten für die Hauptansicht */
  const visibleAgents = activeDept === "all"
    ? userAgents
    : userAgents.filter(a => getDept(a) === activeDept);

  /* Locked Agents: nach Dept filtern (zeige nur, wenn passend) */
  const visibleLocked = lockedAgents.filter(a =>
    activeDept === "all" || getDept(a) === activeDept
  );

  /* Trigger-Modal öffnen */
  function openTrigger(agent: DBAgent) {
    setTaskInput(""); setInputError(false);
    setTrigger({
      agentId:   agent.anthropic_agent_id,
      agentName: agent.name,
      agentDept: getTag(agent),
      icon:      getIcon(agent.name, agent.category),
    });
  }

  /* Agent-Chat starten */
  function startAgent() {
    if (!taskInput.trim()) { setInputError(true); return; }
    if (!trigger) return;
    router.push(`/chat/${trigger.agentId}`);
  }

  /* Stripe Checkout starten */
  async function buyAgent(agent: DBAgent) {
    if (buyingId) return;
    setBuyingId(agent.anthropic_agent_id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicAgentId: agent.anthropic_agent_id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
      } else {
        alert(`Checkout fehlgeschlagen: ${json.error ?? "Unbekannter Fehler"}`);
        setBuyingId(null);
      }
    } catch (e) {
      alert(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
      setBuyingId(null);
    }
  }

  /* Anthropic → Supabase Sync */
  async function syncAgents() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/sync-agents", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const count = json.synced?.length ?? 0;
        const errCount = json.errors?.length ?? 0;
        const errNote = errCount > 0 ? ` (${errCount} Fehler: ${json.errors[0]})` : "";
        setSyncMsg(`✓ ${count} Agent(en) importiert${errNote}`);
        if (count > 0) setTimeout(() => { window.location.reload(); }, 1800);
      } else {
        setSyncMsg(`✗ ${json.message}${json.detail ? ` — ${json.detail}` : ""}`);
      }
    } catch (e) {
      setSyncMsg(`✗ Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="portal-wrapper">

      {/* ══════ SIDEBAR ══════ */}
      <aside className="sidebar">
        <div className="sidebar-logo-bar">
          <div className="sidebar-logo">
            <span style={{ width: 8, height: 8, background: "var(--accent)", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 12px var(--accent)" }} />
            KANA AI
          </div>
        </div>

        <div className="sidebar-user-section">
          <div className="sidebar-user">
            <div className="user-avatar">{userInitials}</div>
            <div>
              <div className="user-name">{userName}</div>
              <div className="user-email">{userEmail}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-title">Übersicht</span>
          <button
            className={`sidebar-item ${view === "agents" && activeDept === "all" ? "active" : ""}`}
            onClick={() => { setView("agents"); setActiveDept("all"); }}
          >
            <span className="item-icon"><LayoutGrid size={16} /></span>
            Alle Agenten
            <span className="item-count">{userAgents.length}</span>
          </button>

          <span className="sidebar-section-title">Abteilungen</span>
          {(["marketing", "sales", "procurement", "operations"] as Dept[]).map(dept => (
            <button
              key={dept}
              className={`sidebar-item ${view === "agents" && activeDept === dept ? "active" : ""}`}
              onClick={() => { setView("agents"); setActiveDept(dept); }}
            >
              <span className="item-icon">
                {dept === "marketing"   && <Megaphone size={16} />}
                {dept === "sales"       && <Briefcase size={16} />}
                {dept === "procurement" && <Package size={16} />}
                {dept === "operations"  && <Settings2 size={16} />}
              </span>
              {DEPT_LABELS[dept]}
              {deptCounts[dept] > 0 && <span className="item-count">{deptCounts[dept]}</span>}
            </button>
          ))}

          <span className="sidebar-section-title" style={{ marginTop: 28 }}>Konto</span>
          <button className="sidebar-item">
            <span className="item-icon"><ShoppingCart size={16} /></span>
            Weitere Agenten
          </button>
          <button
            className={`sidebar-item ${view === "history" ? "active" : ""}`}
            onClick={() => setView("history")}
          >
            <span className="item-icon"><Clock size={16} /></span>
            Verlauf & Nutzung
            {usage.totalThisMonth > 0 && <span className="item-count">{usage.totalThisMonth}</span>}
          </button>
          <button className="sidebar-item">
            <span className="item-icon"><SlidersHorizontal size={16} /></span>
            Einstellungen
          </button>
        </nav>

        <div className="sidebar-footer">
          <SignOutButton redirectUrl="/">
            <button className="sidebar-logout" type="button">
              <LogOut size={16} /> Abmelden
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* ══════ MAIN ══════ */}
      <main className="portal-main">
        <div className="portal-topbar">
          <div className="portal-page-title">
            <span className="breadcrumb">KANA AI</span>
            <span className="breadcrumb-sep"> / </span>
            <span>{view === "history" ? "Verlauf & Nutzung" : DEPT_LABELS[activeDept]}</span>
          </div>
          <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {syncMsg && (
              <span style={{ fontSize: "0.78rem", color: syncMsg.startsWith("✓") ? "var(--success)" : "#F87171", fontWeight: 600 }}>
                {syncMsg}
              </span>
            )}
            <button
              className="btn btn-outline btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
              onClick={syncAgents}
              disabled={syncing}
              title="Agents aus Anthropic Console in die Datenbank schreiben"
            >
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

          {/* ══ AGENTS VIEW ══ */}
          {view === "agents" && (
            <>
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2>Guten Tag, {firstName} 👋</h2>
                  <p>
                    {userAgents.length > 0
                      ? `Sie haben ${userAgents.length} aktive${userAgents.length === 1 ? "n" : ""} Agent${userAgents.length === 1 ? "" : "en"}. Bereit für Ihren nächsten Auftrag.`
                      : "Willkommen bei KANA AI. Kaufen Sie Ihren ersten Agenten, um loszulegen."}
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={14} /> Aktivitäten
                </button>
              </div>

              <div className="stats-row">
                {[
                  { label: "Aktive Agenten", val: String(userAgents.length), change: userAgents.length > 0 ? "Einsatzbereit" : "Noch keine Agenten" },
                  { label: "Sessions diesen Monat", val: String(usedThisMonth), change: `${remaining} von ${MONTHLY_LIMIT} verbleibend` },
                  { label: "Modell", val: "Sonnet 4.6", change: "Frontier Intelligence", small: true },
                ].map((s, i) => (
                  <div key={s.label} className="stat-card" style={{ animation: `card-fadein 0.5s ${i * 0.1}s ease both` }}>
                    <div className="stat-label-small">{s.label}</div>
                    <div className="stat-val" style={s.small ? { fontSize: "1.1rem" } : {}}>{s.val}</div>
                    <div className="stat-change">{s.change}</div>
                  </div>
                ))}
              </div>

              <div className="portal-section-header">
                <div className="portal-section-title">
                  {activeDept === "all" ? "Ihre Agenten" : `${DEPT_LABELS[activeDept]} Agenten`}
                </div>
              </div>

              {userAgents.length === 0 && activeDept === "all" && visibleLocked.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🛍️</div>
                  <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Noch keine Agenten</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Erwerben Sie Ihren ersten Agenten, um die Plattform zu nutzen.</p>
                </div>
              ) : (
                <div className="portal-agents-grid">

                  {/* ── Freigeschaltete Agents ── */}
                  {visibleAgents.map((agent, i) => (
                    <div key={agent.id} className="portal-agent-card" style={{ animation: `card-fadein 0.5s ${i * 0.08}s ease both` }}>
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

                  {/* ── Gesperrte Agents (aus DB, published aber nicht gekauft) ── */}
                  {visibleLocked.map((agent, i) => (
                    <div key={agent.id} className="portal-agent-card locked" style={{ animation: `card-fadein 0.5s ${(visibleAgents.length + i) * 0.08}s ease both` }}>
                      <div className="lock-badge"><Lock size={11} /> Gesperrt</div>
                      <div className="portal-agent-icon" style={{ opacity: 0.45 }}>{getIcon(agent.name, agent.category)}</div>
                      <div className="portal-agent-tag">{getTag(agent)}</div>
                      <div className="portal-agent-name">{agent.name}</div>
                      <div className="portal-agent-desc">{agent.description ?? ""}</div>
                      <div className="portal-agent-footer">
                        <button
                          className="btn-buy"
                          onClick={() => buyAgent(agent)}
                          disabled={buyingId === agent.anthropic_agent_id}
                        >
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

          {/* ══ HISTORY / USAGE VIEW ══ */}
          {view === "history" && (
            <>
              {/* Header */}
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Zap size={20} style={{ color: "var(--accent-bright)" }} />
                    Nutzungsübersicht
                  </h2>
                  <p>Alle Aufrufe und Sessions Ihres Accounts im Überblick.</p>
                </div>
              </div>

              {/* Monthly Limit Card */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px 28px", marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-muted)", marginBottom: 4 }}>Monatliches Limit</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-1px" }}>
                      {usedThisMonth} <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: 500 }}>/ {MONTHLY_LIMIT} Sessions</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>Verbleibend</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: remaining > 10 ? "var(--success)" : "#F87171" }}>{remaining}</div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    width: `${usedPct}%`,
                    background: usedPct > 80 ? "linear-gradient(90deg,#F87171,#ef4444)" : "linear-gradient(90deg,var(--accent),var(--accent-light))",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  <span>{usedPct}% verbraucht</span>
                  <span>Reset am 1. des nächsten Monats</span>
                </div>
              </div>

              {/* Diese Woche vs letzte Woche */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
                <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-glow)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-bright)", flexShrink: 0 }}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="stat-label-small">Diese Woche</div>
                    <div className="stat-val" style={{ fontSize: "1.6rem" }}>
                      {usage.stats.reduce((s, a) => s + a.sessionsThisWeek, 0)}
                    </div>
                    <div className="stat-change">Sessions gestartet</div>
                  </div>
                </div>
                <div className="stat-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(180,180,200,0.08)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="stat-label-small">Letzte Woche</div>
                    <div className="stat-val" style={{ fontSize: "1.6rem" }}>
                      {usage.stats.reduce((s, a) => s + a.sessionsLastWeek, 0)}
                    </div>
                    <div className="stat-change" style={{ color: "var(--text-muted)" }}>Sessions gestartet</div>
                  </div>
                </div>
              </div>

              {/* Pro Agent Breakdown */}
              {usage.stats.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px 28px", marginBottom: 28 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart2 size={16} style={{ color: "var(--accent-bright)" }} />
                    Nutzung pro Agent
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {usage.stats.map(stat => {
                      const pct = Math.min(100, Math.round((stat.totalSessions / Math.max(1, usage.totalThisMonth + (usage.totalLastMonth || 1))) * 100));
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
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                  Diese Woche: {stat.sessionsThisWeek} · Letzte Woche: {stat.sessionsLastWeek}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {weekDiff > 0 && <span style={{ fontSize: "0.72rem", color: "var(--success)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><TrendingUp size={12} />+{weekDiff}</span>}
                              {weekDiff < 0 && <span style={{ fontSize: "0.72rem", color: "#F87171", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><TrendingDown size={12} />{weekDiff}</span>}
                              <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>{stat.totalSessions}</span>
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
                  <Clock size={16} style={{ color: "var(--accent-bright)" }} />
                  Letzte Aktivitäten
                </div>
                {usage.recentSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    Noch keine Sessions gestartet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {usage.recentSessions.map((session, i) => (
                      <div key={session.id} style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "10px 12px", borderRadius: 8,
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>{session.agentName}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Session gestartet</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{formatDate(session.created_at)}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatTime(session.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ══════ TRIGGER MODAL ══════ */}
      {trigger && (
        <div className="trigger-modal" onClick={e => { if (e.target === e.currentTarget) setTrigger(null); }}>
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
              <textarea
                className="form-textarea"
                value={taskInput}
                onChange={e => { setTaskInput(e.target.value); setInputError(false); }}
                placeholder="Beschreiben Sie Ihren Auftrag…"
                style={inputError ? { borderColor: "#F87171" } : {}}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kontext / Zusatzinfos (optional)</label>
              <textarea className="form-textarea" placeholder="Rahmenbedingungen, Zielgruppe oder besondere Anforderungen…" style={{ minHeight: 72 }} />
            </div>
            <button className="btn btn-primary btn-full" style={{ padding: "13px", fontSize: ".95rem", marginTop: 18 }} onClick={startAgent}>
              Agent starten <Play size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
