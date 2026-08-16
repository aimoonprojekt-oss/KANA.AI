"use client";

import React, { useState } from "react";
import type { DBAgent } from "@/lib/platform/supabase";

interface AdminDashboardProps {
  agents: DBAgent[];
}

type AgentRow = DBAgent & { _dirty?: boolean; _saving?: boolean };

const CATEGORIES = [
  "Marketing", "Vertrieb", "Kundenservice", "HR", "Finance",
  "Operations", "IT", "Legal", "Content", "Analyse", "Sonstige",
];

export default function AdminDashboard({ agents: initial }: AdminDashboardProps) {
  const [agents, setAgents] = useState<AgentRow[]>(initial.map((a) => ({ ...a })));
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; ok: boolean } | null>(null);

  // ── Sync ──────────────────────────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync-agents", { method: "POST" });
      const data = await res.json();
      setSyncResult({ message: data.message ?? "Fertig", ok: res.ok });
      if (res.ok) {
        // Agents neu laden
        const r2 = await fetch("/api/admin/agents");
        const d2 = await r2.json();
        if (d2.agents) setAgents(d2.agents);
      }
    } catch {
      setSyncResult({ message: "Netzwerkfehler beim Sync", ok: false });
    } finally {
      setSyncing(false);
    }
  }

  // ── Fuer den eingeloggten Admin freischalten ─────────────────────────────
  //    Legt einen Eintrag in agent_access1 an, ohne Zahlung. Damit wandert der
  //    Agent im Portal von "Alle Agents" nach "Meine Agents" — der Weg, um die
  //    Kundensicht zu pruefen, ohne echt zu kaufen.
  const [granting, setGranting] = useState<string | null>(null);
  const [grantMsg, setGrantMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function grantToMe(agent: AgentRow) {
    setGranting(agent.anthropic_agent_id);
    setGrantMsg(null);
    try {
      const res  = await fetch("/api/admin/grant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicAgentId: agent.anthropic_agent_id }),
      });
      const data = await res.json();
      setGrantMsg({
        id: agent.anthropic_agent_id,
        text: res.ok ? "✓ freigeschaltet — im Portal unter „Meine Agents“" : (data.message ?? "Fehlgeschlagen"),
        ok: res.ok,
      });
    } catch {
      setGrantMsg({ id: agent.anthropic_agent_id, text: "Netzwerkfehler", ok: false });
    } finally {
      setGranting(null);
    }
  }

  // ── Field change ─────────────────────────────────────────────────────────
  function updateField(agentId: string, field: keyof AgentRow, value: unknown) {
    setAgents((prev) =>
      prev.map((a) =>
        a.anthropic_agent_id === agentId ? { ...a, [field]: value, _dirty: true } : a
      )
    );
  }

  // ── Save row ─────────────────────────────────────────────────────────────
  async function saveAgent(agent: AgentRow) {
    setAgents((prev) =>
      prev.map((a) => (a.anthropic_agent_id === agent.anthropic_agent_id ? { ...a, _saving: true } : a))
    );
    try {
      await fetch("/api/admin/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropic_agent_id: agent.anthropic_agent_id,
          published:          agent.published,
          featured:           agent.featured,
          price_eur:          agent.price_eur,
          stripe_price_id:    agent.stripe_price_id ?? null,
          category:           agent.category ?? null,
        }),
      });
    } finally {
      setAgents((prev) =>
        prev.map((a) =>
          a.anthropic_agent_id === agent.anthropic_agent_id
            ? { ...a, _saving: false, _dirty: false }
            : a
        )
      );
    }
  }

  const published  = agents.filter((a) => a.published && !a.archived).length;
  const archiviert = agents.filter((a) => a.archived).length;
  const ohneWs     = agents.filter((a) => !a.workspace && !a.archived).length;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: "#0D1F3C", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>KANA AI</div>
        <div style={{ color: "#637496", fontSize: 13 }}>Admin</div>
        <div style={{ flex: 1 }} />
        <a href="/dashboard" style={{ color: "#94A3B8", fontSize: 13, textDecoration: "none" }}>
          → Dashboard
        </a>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Stats + Sync ── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0D1F3C", marginBottom: 4 }}>
              Agent-Verwaltung
            </h1>
            <p style={{ color: "#64748B", fontSize: 14 }}>
              {agents.length} Agent(en) gesamt · {published} verkäuflich{archiviert > 0 ? ` · ${archiviert} archiviert` : ""}{ohneWs > 0 ? ` · ${ohneWs} ohne Workspace` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {syncResult && (
              <div style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                background: syncResult.ok ? "#D1FAE5" : "#FEE2E2",
                color:      syncResult.ok ? "#065F46" : "#991B1B",
                maxWidth: 320,
              }}>
                {syncResult.message}
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                background: syncing ? "#94A3B8" : "#0D1F3C",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: syncing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {syncing ? (
                <>
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Sync läuft…
                </>
              ) : (
                "↻ Aus Anthropic Console syncen"
              )}
            </button>
          </div>
        </div>

        {/* ── Info Box ── */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "#1E40AF", lineHeight: 1.6 }}>
          <strong>Wie es funktioniert:</strong> „Sync" liest alle konfigurierten Console-Workspaces und schreibt sie hier hinein.
          Neue Agents sind immer erst <em>unsichtbar</em> — Freigabe zum Verkauf ist eine bewusste Entscheidung.
          Danach: „Sichtbar" einschalten, Preis und Stripe Price ID setzen, „Speichern".
          Mit „Für mich freischalten" bekommst du den Agent ohne Zahlung ins eigene Portal, um die Kundensicht zu prüfen.
          Agents, die in der Console nicht mehr existieren, werden <em>archiviert</em> statt gelöscht.
        </div>

        {agents.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "48px 24px", textAlign: "center", color: "#94A3B8" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬆</div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#64748B" }}>Noch keine Agents synchronisiert</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Drücke den Sync-Button oben um Agents aus der Anthropic Console zu laden.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {agents.map((agent) => (
              <AgentCard
                key={agent.anthropic_agent_id}
                agent={agent}
                onChange={(field, value) => updateField(agent.anthropic_agent_id, field, value)}
                onSave={() => saveAgent(agent)}
                onGrant={() => grantToMe(agent)}
                granting={granting === agent.anthropic_agent_id}
                grantMsg={grantMsg?.id === agent.anthropic_agent_id ? grantMsg : null}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
      `}</style>
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({
  agent,
  onChange,
  onSave,
  onGrant,
  granting,
  grantMsg,
}: {
  agent: AgentRow;
  onChange: (field: keyof AgentRow, value: unknown) => void;
  onSave: () => void;
  onGrant: () => void;
  granting: boolean;
  grantMsg: { text: string; ok: boolean } | null;
}) {
  const inputStyle: React.CSSProperties = {
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    background: "#fff",
    color: "#0F172A",
    outline: "none",
  };

  return (
    <div style={{
      background: agent.archived ? "#F8FAFC" : "#fff",
      borderRadius: 12,
      border: agent._dirty ? "1px solid #F59E0B" : agent.archived ? "1px dashed #CBD5E1" : "1px solid #E2E8F0",
      padding: "18px 20px",
      opacity: agent.archived ? 0.72 : 1,
      transition: "border-color 0.15s",
    }}>
      {agent.archived && (
        <div style={{
          background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
          borderRadius: 8, padding: "7px 12px", fontSize: 12, marginBottom: 14, lineHeight: 1.5,
        }}>
          <strong>Archiviert</strong> — dieser Agent liegt nicht mehr in der Claude Console.
          Er ist aus allen Kundenansichten verschwunden. Die Zeile bleibt erhalten, weil
          Zugänge und Sitzungen daran hängen. Taucht er in der Console wieder auf, hebt der
          nächste Sync das Archiv automatisch auf.
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Name + IDs */}
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "#0D1F3C", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {agent.name}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
              padding: "2px 8px", borderRadius: 100,
              background: agent.workspace ? "#E0E7FF" : "#FEE2E2",
              color:      agent.workspace ? "#3730A3" : "#991B1B",
            }}>
              {agent.workspace ?? "kein Workspace"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace", marginBottom: 2 }}>
            {agent.anthropic_agent_id}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            /{agent.slug}
          </div>
        </div>

        {/* Kategorie */}
        <div style={{ flex: "0 0 150px" }}>
          <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 500 }}>KATEGORIE</label>
          <select
            value={agent.category ?? ""}
            onChange={(e) => onChange("category", e.target.value || null)}
            style={{ ...inputStyle, width: "100%" }}
          >
            <option value="">— keine —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Preis */}
        <div style={{ flex: "0 0 120px" }}>
          <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 500 }}>PREIS (€/Monat)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={agent.price_eur}
            onChange={(e) => onChange("price_eur", parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>

        {/* Stripe Price ID */}
        <div style={{ flex: "1 1 220px" }}>
          <label style={{ display: "block", fontSize: 11, color: "#64748B", marginBottom: 4, fontWeight: 500 }}>STRIPE PRICE ID</label>
          <input
            type="text"
            placeholder="price_xxxxxxxxxxxxx"
            value={agent.stripe_price_id ?? ""}
            onChange={(e) => onChange("stripe_price_id", e.target.value || null)}
            style={{ ...inputStyle, width: "100%", fontFamily: "monospace" }}
          />
        </div>

        {/* Toggles + Save */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Toggle
              label="Sichtbar"
              checked={agent.published}
              onChange={(v) => onChange("published", v)}
              color="#10B981"
            />
            <Toggle
              label="Featured"
              checked={agent.featured}
              onChange={(v) => onChange("featured", v)}
              color="#F59E0B"
            />
          </div>
          <button
            onClick={onSave}
            disabled={!agent._dirty || agent._saving}
            style={{
              background: agent._dirty ? "#0D1F3C" : "#E2E8F0",
              color:      agent._dirty ? "#fff"    : "#94A3B8",
              border: "none",
              borderRadius: 7,
              padding: "7px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: agent._dirty && !agent._saving ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {agent._saving ? "Speichert…" : agent._dirty ? "Speichern" : "Gespeichert"}
          </button>

          {/* Ohne Zahlung fuer den eingeloggten Admin freischalten —
              zum Pruefen der Kundensicht. */}
          <button
            onClick={onGrant}
            disabled={granting || !agent.published}
            title={
              agent.published
                ? "Diesen Agenten ohne Zahlung fuer dich freischalten"
                : "Erst sichtbar schalten und speichern"
            }
            style={{
              background: "transparent",
              color:      agent.published ? "#0D1F3C" : "#94A3B8",
              border: `1px solid ${agent.published ? "#CBD5E1" : "#E2E8F0"}`,
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: granting || !agent.published ? "not-allowed" : "pointer",
            }}
          >
            {granting ? "Schalte frei…" : "Für mich freischalten"}
          </button>

          {grantMsg && (
            <span style={{ fontSize: 11, color: grantMsg.ok ? "#059669" : "#DC2626", maxWidth: 240, textAlign: "right" }}>
              {grantMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
      <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>{label.toUpperCase()}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24,
          background: checked ? color : "#CBD5E1",
          borderRadius: 12,
          position: "relative",
          transition: "background 0.2s",
          cursor: "pointer",
        }}
      >
        <div style={{
          position: "absolute",
          top: 3, left: checked ? 21 : 3,
          width: 18, height: 18,
          background: "#fff",
          borderRadius: "50%",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
    </label>
  );
}
