"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, Megaphone, Briefcase, Package, Settings2,
  ShoppingCart, Clock, SlidersHorizontal, LogOut,
  Play, Lock, CreditCard, Activity, Plus, X,
  Search, Scissors, Send, Lightbulb, Gem,
} from "lucide-react";
import type { AgentAccess } from "@/lib/supabase";

/* ── Types ── */
type Dept = "all" | "marketing" | "sales" | "procurement" | "operations" | "research";

interface TriggerState {
  agentId: string;
  agentName: string;
  agentDept: string;
  icon: React.ReactNode;
}

interface Props {
  userAgents:   AgentAccess[];
  userName:     string;
  userInitials: string;
  userEmail:    string;
}

/* ── Locked placeholder agents (future products) ── */
const LOCKED_AGENTS = [
  { id: "locked-video",  name: "Video Cutter",    dept: "marketing", tag: "Content & Video", desc: "Automatisches Video-Editing für Social Media und Kampagnen.",        icon: <Scissors size={22} /> },
  { id: "locked-brand",  name: "Brand Expert",    dept: "marketing", tag: "Brand",           desc: "Markenstrategie, Positionierung und konsistente Markenkommunikation.", icon: <Gem size={22} /> },
];

/* ── Dept label map ── */
const DEPT_LABELS: Record<Dept, string> = {
  all:         "Alle Agenten",
  marketing:   "Marketing",
  sales:       "Sales",
  procurement: "Procurement",
  operations:  "Operations",
  research:    "Research",
};

/* ── Assign dept + icon to a user agent ── */
function getDept(name: string): Dept {
  const n = name.toLowerCase();
  if (n.includes("research"))                              return "research";
  if (n.includes("sales") || n.includes("mail") || n.includes("cold")) return "sales";
  if (n.includes("market") || n.includes("creative") || n.includes("brand") || n.includes("video")) return "marketing";
  return "all";
}

function getIcon(name: string): React.ReactNode {
  const n = name.toLowerCase();
  if (n.includes("research"))                return <Search size={22} />;
  if (n.includes("cold") || n.includes("mail")) return <Send size={22} />;
  if (n.includes("creative"))                return <Lightbulb size={22} />;
  if (n.includes("brand"))                   return <Gem size={22} />;
  if (n.includes("video"))                   return <Scissors size={22} />;
  return <LayoutGrid size={22} />;
}

function getTag(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("research"))  return "Research";
  if (n.includes("cold") || n.includes("mail")) return "Sales";
  if (n.includes("creative"))  return "Marketing";
  if (n.includes("brand"))     return "Brand";
  if (n.includes("video"))     return "Content & Video";
  return "KI-Agent";
}

/* ═══════════════════════════════════════════════════════ */

export default function PortalDashboard({ userAgents, userName, userInitials, userEmail }: Props) {
  const router = useRouter();
  const [activeDept, setActiveDept] = useState<Dept>("all");
  const [trigger, setTrigger]       = useState<TriggerState | null>(null);
  const [taskInput, setTaskInput]   = useState("");
  const [inputError, setInputError] = useState(false);

  const firstName = userName.split(" ")[0];

  /* Count agents per dept for sidebar badges */
  const deptCounts: Record<string, number> = { marketing: 0, sales: 0, research: 0 };
  userAgents.forEach(a => {
    const d = getDept(a.agent_name);
    if (d !== "all") deptCounts[d] = (deptCounts[d] ?? 0) + 1;
  });

  /* Filter logic */
  const visibleAgents = activeDept === "all"
    ? userAgents
    : userAgents.filter(a => getDept(a.agent_name) === activeDept);

  const visibleLocked = activeDept === "all" || activeDept === "marketing"
    ? LOCKED_AGENTS
    : [];

  /* ── Trigger modal ── */
  function openTrigger(agent: AgentAccess) {
    setTaskInput("");
    setInputError(false);
    setTrigger({
      agentId:   agent.agent_id,
      agentName: agent.agent_name,
      agentDept: getTag(agent.agent_name),
      icon:      getIcon(agent.agent_name),
    });
  }

  function startAgent() {
    if (!taskInput.trim()) { setInputError(true); return; }
    if (!trigger) return;
    router.push(`/chat/${trigger.agentId}`);
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
          <button className={`sidebar-item ${activeDept === "all" ? "active" : ""}`} onClick={() => setActiveDept("all")}>
            <span className="item-icon"><LayoutGrid size={16} /></span>
            Alle Agenten
            <span className="item-count">{userAgents.length}</span>
          </button>

          <span className="sidebar-section-title">Abteilungen</span>
          {(["marketing", "sales", "procurement", "operations"] as Dept[]).map(dept => (
            <button key={dept} className={`sidebar-item ${activeDept === dept ? "active" : ""}`} onClick={() => setActiveDept(dept)}>
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
          <button className="sidebar-item">
            <span className="item-icon"><Clock size={16} /></span>
            Aufgaben-Historie
          </button>
          <button className="sidebar-item">
            <span className="item-icon"><SlidersHorizontal size={16} /></span>
            Einstellungen
          </button>
        </nav>

        <div className="sidebar-footer">
          <SignOutButton redirectUrl="/sign-in">
            <button className="sidebar-logout" type="button">
              <LogOut size={16} /> Abmelden
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* ══════ MAIN ══════ */}
      <main className="portal-main">
        {/* Topbar */}
        <div className="portal-topbar">
          <div className="portal-page-title">
            <span className="breadcrumb">KANA AI</span>
            <span className="breadcrumb-sep"> / </span>
            <span>{DEPT_LABELS[activeDept]}</span>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Agent hinzufügen
            </button>
          </div>
        </div>

        <div className="portal-content">
          {/* Welcome Banner */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <h2>Guten Tag, {firstName} 👋</h2>
              <p>
                {userAgents.length > 0
                  ? `Sie haben ${userAgents.length} aktive${userAgents.length === 1 ? "n" : ""} Agent${userAgents.length === 1 ? "en" : "en"}. Bereit für Ihren nächsten Auftrag.`
                  : "Willkommen bei KANA AI. Kaufen Sie Ihren ersten Agenten, um loszulegen."}
              </p>
            </div>
            <button className="btn btn-outline btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} /> Aktivitäten
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label-small">Aktive Agenten</div>
              <div className="stat-val">{userAgents.length}</div>
              <div className="stat-change">{userAgents.length > 0 ? "Einsatzbereit" : "Noch keine Agenten"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label-small">Plattform</div>
              <div className="stat-val" style={{ fontSize: "1.2rem" }}>KANA AI</div>
              <div className="stat-change" style={{ color: "var(--accent-bright)" }}>Powered by Claude</div>
            </div>
            <div className="stat-card">
              <div className="stat-label-small">Modell</div>
              <div className="stat-val" style={{ fontSize: "1.1rem" }}>Sonnet 4.6</div>
              <div className="stat-change">Frontier Intelligence</div>
            </div>
          </div>

          {/* Agent Grid */}
          <div className="portal-section-header">
            <div className="portal-section-title">
              {activeDept === "all" ? "Ihre Agenten" : `${DEPT_LABELS[activeDept]} Agenten`}
            </div>
          </div>

          {userAgents.length === 0 && activeDept === "all" ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛍️</div>
              <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Noch keine Agenten</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Erwerben Sie Ihren ersten Agenten, um die Plattform zu nutzen.
              </p>
            </div>
          ) : (
            <div className="portal-agents-grid">
              {/* Unlocked agents */}
              {visibleAgents.map(agent => (
                <div key={agent.id} className="portal-agent-card">
                  <div className="portal-agent-icon">{getIcon(agent.agent_name)}</div>
                  <div className="portal-agent-tag">{getTag(agent.agent_name)}</div>
                  <div className="portal-agent-name">{agent.agent_name}</div>
                  <div className="portal-agent-desc">{agent.agent_description}</div>
                  <div className="portal-agent-footer">
                    <button className="btn-trigger-portal" onClick={() => openTrigger(agent)}>
                      <Play size={13} /> Starten
                    </button>
                  </div>
                </div>
              ))}

              {/* Locked agents */}
              {visibleLocked.map(agent => (
                <div key={agent.id} className="portal-agent-card locked">
                  <div className="lock-badge"><Lock size={11} /> Gesperrt</div>
                  <div className="portal-agent-icon" style={{ opacity: 0.45 }}>{agent.icon}</div>
                  <div className="portal-agent-tag">{agent.tag}</div>
                  <div className="portal-agent-name">{agent.name}</div>
                  <div className="portal-agent-desc">{agent.desc}</div>
                  <div className="portal-agent-footer">
                    <button className="btn-buy">
                      <CreditCard size={13} /> Jetzt kaufen
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
              <button className="modal-close-btn" onClick={() => setTrigger(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Ihre Aufgabe *</label>
              <textarea
                className="form-textarea"
                value={taskInput}
                onChange={e => { setTaskInput(e.target.value); setInputError(false); }}
                placeholder={`Beschreiben Sie Ihren Auftrag…`}
                style={inputError ? { borderColor: "#F87171" } : {}}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kontext / Zusatzinfos (optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Rahmenbedingungen, Zielgruppe oder besondere Anforderungen…"
                style={{ minHeight: 72 }}
              />
            </div>

            <button
              className="btn btn-primary btn-full"
              style={{ padding: "13px", fontSize: ".95rem", marginTop: 18 }}
              onClick={startAgent}
            >
              Agent starten <Play size={15} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
