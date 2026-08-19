"use client";

import React, { useState } from "react";
import type { DBAgent } from "@/lib/platform/supabase";
import { KanaLogo } from "@/app/components/ui/KanaMark";

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
          setup_eur:          agent.setup_eur ?? null,
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
    <div className="admin">
      <header className="portal-header">
        <div className="portal-header__left">
          <KanaLogo size={22} fontSize={17} />
          <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Verwaltung</span>
        </div>
        <div className="portal-header__right">
          <a href="/dashboard" className="btn btn-outline btn-sm">Zum Portal</a>
        </div>
      </header>

      <div className="admin__inhalt">
        <div className="portal-welcome" style={{ padding: "30px 0 22px" }}>
          <div>
            <h2>Agent-Verwaltung</h2>
            <p>
              {agents.length} {agents.length === 1 ? "Agent" : "Agents"} gesamt · {published} verkäuflich
              {archiviert > 0 ? ` · ${archiviert} archiviert` : ""}
              {ohneWs > 0 ? ` · ${ohneWs} ohne Workspace` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {syncResult && (
              <span className={`admin-meldung${syncResult.ok ? "" : " is-fehler"}`}>{syncResult.message}</span>
            )}
            <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
              {syncing ? "Sync läuft…" : "Aus Anthropic Console syncen"}
            </button>
          </div>
        </div>

        <div className="admin-hinweis">
          <span className="mono-sm" style={{ color: "var(--accent)" }}>Wie es funktioniert</span>
          <p>
            „Sync" liest alle konfigurierten Console-Workspaces und schreibt sie hier hinein.
            Neue Agents sind immer erst unsichtbar — die Freigabe zum Verkauf ist eine bewusste
            Entscheidung. Danach: „Sichtbar" einschalten, Preise und Stripe Price ID setzen, speichern.
            Mit „Für mich freischalten" bekommst du den Agent ohne Zahlung ins eigene Portal, um die
            Kundensicht zu prüfen. Agents, die in der Console nicht mehr existieren, werden archiviert
            statt gelöscht.
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="card-flat" style={{ textAlign: "center", padding: "56px 24px" }}>
            <div className="portal-section-title" style={{ marginBottom: 8 }}>Noch keine Agents synchronisiert</div>
            <p className="t-meta" style={{ color: "var(--text-muted)" }}>
              Der Sync oben lädt die Agents aus der Anthropic Console.
            </p>
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
    </div>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({
  agent, onChange, onSave, onGrant, granting, grantMsg,
}: {
  agent: AgentRow;
  onChange: (field: keyof AgentRow, value: unknown) => void;
  onSave: () => void;
  onGrant: () => void;
  granting: boolean;
  grantMsg: { text: string; ok: boolean } | null;
}) {
  const zustand = agent.archived ? " is-archiviert" : agent._dirty ? " is-geaendert" : "";

  return (
    <div className={`admin-karte${zustand}`}>
      {agent.archived && (
        <div className="admin-archiv">
          <strong>Archiviert</strong> — dieser Agent liegt nicht mehr in der Claude Console.
          Er ist aus allen Kundenansichten verschwunden. Die Zeile bleibt erhalten, weil Zugänge
          und Sitzungen daran hängen. Taucht er in der Console wieder auf, hebt der nächste Sync
          das Archiv automatisch auf.
        </div>
      )}

      <div className="admin-karte__zeile">
        {/* Name und Kennungen */}
        <div className="admin-feld" style={{ flex: "1 1 220px", minWidth: 200 }}>
          <div className="admin-name">
            {agent.name}
            <span className={`badge ${agent.workspace ? "badge-outline" : "badge-fehlt"}`}>
              {agent.workspace ?? "kein Workspace"}
            </span>
          </div>
          <div className="mono-num admin-kennung">{agent.anthropic_agent_id}</div>
          <div className="mono-num admin-kennung">/{agent.slug}</div>
        </div>

        <div className="admin-feld" style={{ flex: "0 0 150px" }}>
          <label className="form-label" htmlFor={`kat-${agent.id}`}>Kategorie</label>
          <select
            id={`kat-${agent.id}`}
            className="form-input"
            value={agent.category ?? ""}
            onChange={(e) => onChange("category", e.target.value || null)}
          >
            <option value="">— keine —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="admin-feld" style={{ flex: "0 0 120px" }}>
          <label className="form-label" htmlFor={`preis-${agent.id}`}>€ / Monat</label>
          <input
            id={`preis-${agent.id}`} className="form-input mono-num"
            type="number" min={0} step={1}
            value={agent.price_eur}
            onChange={(e) => onChange("price_eur", parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Einmalige Einrichtung — steht auf der Preisseite und im Portal
            neben dem Monatsbeitrag. Leer heisst dort "nach Aufwand". */}
        <div className="admin-feld" style={{ flex: "0 0 130px" }}>
          <label className="form-label" htmlFor={`setup-${agent.id}`}>€ Einrichtung</label>
          <input
            id={`setup-${agent.id}`} className="form-input mono-num"
            type="number" min={0} step={1} placeholder="nach Aufwand"
            value={agent.setup_eur ?? ""}
            onChange={(e) => onChange("setup_eur", e.target.value === "" ? null : parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className="admin-feld" style={{ flex: "1 1 220px" }}>
          <label className="form-label" htmlFor={`stripe-${agent.id}`}>Stripe Price ID</label>
          <input
            id={`stripe-${agent.id}`} className="form-input mono-num"
            type="text" placeholder="price_xxxxxxxxxxxxx"
            value={agent.stripe_price_id ?? ""}
            onChange={(e) => onChange("stripe_price_id", e.target.value || null)}
          />
        </div>

        <div className="admin-aktionen">
          <div style={{ display: "flex", gap: 16 }}>
            <Toggle label="Sichtbar" checked={agent.published} onChange={(v) => onChange("published", v)} />
            <Toggle label="Featured" checked={agent.featured} onChange={(v) => onChange("featured", v)} />
          </div>
          <button
            className={agent._dirty ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            onClick={onSave}
            disabled={!agent._dirty || agent._saving}
          >
            {agent._saving ? "Speichert…" : agent._dirty ? "Speichern" : "Gespeichert"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={onGrant}
            disabled={granting || !agent.published}
            title={agent.published
              ? "Diesen Agenten ohne Zahlung für dich freischalten"
              : "Erst sichtbar schalten und speichern"}
          >
            {granting ? "Schalte frei…" : "Für mich freischalten"}
          </button>
          {grantMsg && (
            <span className={`admin-meldung${grantMsg.ok ? "" : " is-fehler"}`}>{grantMsg.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Umschalter ────────────────────────────────────────────────────────────────
function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="admin-schalter">
      <span className="form-label" style={{ marginBottom: 6 }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`schalter${checked ? " is-an" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="schalter__knopf" />
      </button>
    </label>
  );
}
