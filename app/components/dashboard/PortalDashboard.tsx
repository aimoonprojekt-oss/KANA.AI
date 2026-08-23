"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { X, ArrowRight, LogOut } from "lucide-react";
import type { DBAgent, UsageOverview } from "@/lib/platform/supabase";
import { ABTEILUNGEN, abteilungVon, setupVon, eur, type AbteilungId } from "@/lib/abteilungen";
import KanaMark, { KanaLogo } from "@/app/components/ui/KanaMark";
import Orbital from "@/app/components/ui/Orbital";
import Verlaufsdiagramm from "@/app/components/ui/Verlaufsdiagramm";
import KiHinweis from "@/app/components/ui/KiHinweis";

/* ─── Konstanten ─────────────────────────────────────── */
const MONTHLY_LIMIT = 50;
const SUPPORT_EMAIL = "support@kanaai.de";

/* ─── Types ──────────────────────────────────────────── */
type View = "agents" | "history" | "usage" | "billing";

const TABS: { id: View; label: string }[] = [
  { id: "agents",  label: "Agents" },
  { id: "history", label: "Verlauf" },
  { id: "usage",   label: "Verbrauch" },
  { id: "billing", label: "Abrechnung" },
];

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

/* ─── Helfer ─────────────────────────────────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function fmtEur(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });
}
function tagVon(agent: DBAgent) {
  if (!agent.category) return "Agent";
  return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
}

/* ═══════════════════════════════════════════════════════ */

export default function PortalDashboard({
  userAgents, lockedAgents, userName, userInitials, userEmail, usage, purchasedSlug, isAdmin,
}: Props) {
  const router = useRouter();

  const [view, setView]             = useState<View>("agents");
  const [activeDept, setActiveDept] = useState<AbteilungId>("marketing");
  /* Meine Agents = gebucht, Alle Agents = Katalog. Der haeufigste Fall
     zuerst — wer schon gebucht hat, will zu seinen Agents. */
  const [umfang, setUmfang] = useState<"meine" | "alle">("meine");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(!!purchasedSlug);

  const [showOnboarding, setShowOnboarding] = useState(false);

  const [subscriptions, setSubscriptions]   = useState<BillingSubscription[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading]   = useState(false);

  /* ── Abgeleitet ── */
  const firstName     = userName.split(" ")[0];
  const usedThisMonth = usage.totalThisMonth;
  const remaining     = Math.max(0, MONTHLY_LIMIT - usedThisMonth);
  const usedPct       = Math.min(100, Math.round((usedThisMonth / MONTHLY_LIMIT) * 100));

  /* Gebuchte und buchbare Agenten in einer Liste, nach Abteilung sortiert.
     owned entscheidet ueber Abzeichen, Aktion und die Fuellung im Orbital. */
  const alleAgenten = [
    ...userAgents.map((a)   => ({ agent: a, owned: true  })),
    ...lockedAgents.map((a) => ({ agent: a, owned: false })),
  ];

  const sichtbar = umfang === "meine"
    ? alleAgenten.filter((e) => e.owned)
    : alleAgenten;

  const abteilungen = ABTEILUNGEN.map((d) => ({
    ...d,
    eintraege: sichtbar.filter((e) => abteilungVon(e.agent) === d.id),
  }));

  /* Das Orbital zeigt immer den ganzen Aufbau, auch unter "Meine Agents" —
     sonst verschwindet gerade das, was man dazubuchen koennte. */
  const orbitalAbteilungen = ABTEILUNGEN.map((d) => ({
    ...d,
    eintraege: alleAgenten.filter((e) => abteilungVon(e.agent) === d.id),
  }));

  const orbitalDepts = orbitalAbteilungen.map((d) => ({
    id: d.id,
    name: d.name,
    angle: d.angle,
    agents: d.eintraege.map((e) => ({ id: e.agent.id, name: e.agent.name, owned: e.owned })),
  }));

  const aktive = abteilungen.find((d) => d.id === activeDept) ?? abteilungen[0];

  /* Vorschlag fuer die naechste Abteilung: die mit den meisten noch
     buchbaren Agenten, in der noch nichts gebucht ist. */
  const upsell = orbitalAbteilungen
    .filter((d) => d.eintraege.length > 0 && d.eintraege.every((e) => !e.owned))
    .sort((a, b) => b.eintraege.length - a.eintraege.length)[0];
  const upsellAbPreis = upsell
    ? Math.min(...upsell.eintraege.map((e) => e.agent.price_eur).filter((p) => p > 0))
    : 0;

  const totalMonthly  = subscriptions.reduce((s, sub) => s + sub.priceEur, 0);
  const estimatedCost = totalMonthly > 0 ? (usedThisMonth / MONTHLY_LIMIT) * totalMonthly : null;

  /* ── Effekte ── */
  useEffect(() => {
    const done = localStorage.getItem("kana_onboarding_done");
    if (!done && userAgents.length === 0) setShowOnboarding(true);
  }, [userAgents.length]);

  useEffect(() => {
    if (!showPurchaseSuccess) return;
    const t = setTimeout(() => setShowPurchaseSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [showPurchaseSuccess]);

  useEffect(() => {
    if (view !== "billing" || subscriptions.length > 0) return;
    setBillingLoading(true);
    fetch("/api/billing/info")
      .then((r) => r.json())
      .then((d) => setSubscriptions(d.subscriptions ?? []))
      .catch(() => setSubscriptions([]))
      .finally(() => setBillingLoading(false));
  }, [view, subscriptions.length]);

  /* Beim ersten Aufbau in die Abteilung springen, in der schon etwas
     gebucht ist — sonst startet der Kunde auf einer leeren Ansicht. */
  useEffect(() => {
    const mit = ABTEILUNGEN.find((d) => userAgents.some((a) => abteilungVon(a) === d.id));
    if (mit) setActiveDept(mit.id);
    /* Wer noch nichts gebucht hat, sieht sonst eine leere Seite. */
    if (userAgents.length === 0) setUmfang("alle");
  }, [userAgents]);

  /* ── Handler ── */
  function openChat(agent: DBAgent) {
    router.push(`/chat/${agent.anthropic_agent_id}`);
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
        setSyncMsg(`${count} Agent(en) importiert${errCount > 0 ? ` (${errCount} Fehler)` : ""}`);
        if (count > 0) setTimeout(() => window.location.reload(), 1800);
      } else {
        setSyncMsg(json.message);
      }
    } catch (e) {
      setSyncMsg(`Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}`);
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

  /* ════════════════════════════════════════════════════ */
  return (
    <div className="portal-app">
      <div className="portal-shell">

        {/* ══ Kopfleiste ══ */}
        <header className="portal-header">
          <div className="portal-header__left">
            <KanaLogo size={22} fontSize={17} />
            <nav className="portal-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`portal-tab${view === t.id ? " active" : ""}`}
                  aria-current={view === t.id ? "page" : undefined}
                  onClick={() => setView(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="portal-header__right">
            {syncMsg && <span className="mono-num" style={{ color: "var(--text-muted)" }}>{syncMsg}</span>}
            {isAdmin && (
              <>
                <button className="btn btn-outline btn-sm" onClick={syncAgents} disabled={syncing}>
                  {syncing ? "Sync läuft…" : "Sync aus Console"}
                </button>
                <a href="/admin" className="btn btn-outline btn-sm">Verwaltung</a>
              </>
            )}
            <span className="t-meta" style={{ color: "var(--text-secondary)" }}>{userName}</span>
            <span className="user-avatar" title={userEmail}>{userInitials}</span>
            <SignOutButton redirectUrl="/">
              <button type="button" className="modal-close-btn" title="Abmelden" aria-label="Abmelden">
                <LogOut size={16} />
              </button>
            </SignOutButton>
          </div>
        </header>

        {/* ══ Kauf-Erfolgsmeldung ══ */}
        {showPurchaseSuccess && (
          <div className="portal-section" style={{ paddingBottom: 0 }}>
            <div className="banner">
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Agent freigeschaltet</div>
                <div className="t-meta" style={{ color: "var(--text-secondary)" }}>
                  Der Agent ist eingerichtet und ab sofort einsatzbereit.
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowPurchaseSuccess(false)} aria-label="Meldung schließen">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════ AGENTS ══════════════════ */}
        {view === "agents" && (
          <>
            <div className="portal-welcome">
              <div>
                <h2>Willkommen zurück, {firstName}</h2>
                <p>
                  {userAgents.length > 0
                    ? `${userAgents.length} ${userAgents.length === 1 ? "Agent ist" : "Agents sind"} für dich im Einsatz.`
                    : "Noch kein Agent gebucht. Im Katalog unten stehen die verfügbaren."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="seg" role="tablist" aria-label="Umfang">
                <button
                  type="button" role="tab" aria-selected={umfang === "meine"}
                  className={`seg-item${umfang === "meine" ? " active" : ""}`}
                  onClick={() => { setUmfang("meine"); setSelectedAgent(null); }}
                >
                  Meine Agents <span className="seg-item__count">{userAgents.length}</span>
                </button>
                <button
                  type="button" role="tab" aria-selected={umfang === "alle"}
                  className={`seg-item${umfang === "alle" ? " active" : ""}`}
                  onClick={() => { setUmfang("alle"); setSelectedAgent(null); }}
                >
                  Alle Agents <span className="seg-item__count">{alleAgenten.length}</span>
                </button>
              </div>
              <div className="seg" role="tablist" aria-label="Abteilung">
                {abteilungen.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    aria-selected={d.id === activeDept}
                    className={`seg-item${d.id === activeDept ? " active" : ""}`}
                    onClick={() => { setActiveDept(d.id); setSelectedAgent(null); }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
              </div>
            </div>

            <div className="portal-section" style={{ paddingTop: 0 }}>
              <KiHinweis lang />
            </div>

            <div className="agents-layout">
              {/* ── links: Tabelle ── */}
              <div>
                <div className="table-head" style={{ gridTemplateColumns: "1fr 130px 130px 150px" }}>
                  <span>Agent</span><span>Bereich</span><span>Status</span>
                  <span style={{ textAlign: "right" }}>Aktion</span>
                </div>

                {aktive.eintraege.length === 0 ? (
                  <div className="table-empty">
                    {umfang === "meine"
                      ? <>In {aktive.name} hast du noch keinen Agent gebucht.{" "}
                          <button type="button" className="table-empty__link" onClick={() => setUmfang("alle")}>
                            Alle Agents ansehen
                          </button></>
                      : <>In {aktive.name} ist noch kein Agent verfügbar.</>}
                  </div>
                ) : (
                  aktive.eintraege.map(({ agent, owned }) => (
                    <div
                      key={agent.id}
                      className={`table-row${selectedAgent === agent.id ? " is-selected" : ""}`}
                      style={{ gridTemplateColumns: "1fr 130px 130px 150px" }}
                      onMouseEnter={() => setSelectedAgent(agent.id)}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{agent.name}</span>
                        <span className="t-meta" style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {agent.description ?? "—"}
                        </span>
                      </div>
                      <span className="mono-num" style={{ color: "var(--text-secondary)" }}>{tagVon(agent)}</span>
                      <span>
                        <span className={owned ? "badge badge-solid" : "badge badge-outline"}>
                          {owned ? "aktiv" : "gesperrt"}
                        </span>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        {owned ? (
                          <button className="btn-trigger-portal" onClick={() => openChat(agent)}>
                            Chat öffnen
                          </button>
                        ) : (
                          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                            <button
                              className="btn-buy"
                              onClick={() => buyAgent(agent)}
                              disabled={buyingId === agent.anthropic_agent_id}
                            >
                              {buyingId === agent.anthropic_agent_id
                                ? "Weiterleitung…"
                                : `Buchen · ${agent.price_eur} €`}
                            </button>
                            {/* Die einmalige Einrichtung steht hier, nicht im
                                Kleingedruckten — sie faellt beim Buchen an. */}
                            <span className="mono-num" style={{ color: "var(--text-muted)", fontSize: 11 }}>
                              {(() => {
                                const st = setupVon(agent);
                                if (st === 0) return "keine Einrichtungsgebühr";
                                if (st === null) return "+ Einrichtung nach Aufwand";
                                return `+ ${eur(st)} einmalig`;
                              })()}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}

                {/* Der Entwurf zeigt hier "Läuft gerade". Ob eine Sitzung noch
                    laeuft, steht heute nicht in den Daten — deshalb die
                    letzten Sitzungen, gleicher Platz, echte Werte. */}
                <div className="portal-section" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Zuletzt gelaufen</span>
                  {usage.recentSessions.length === 0 ? (
                    <span className="t-meta" style={{ color: "var(--text-muted)" }}>Noch keine Sitzung gestartet.</span>
                  ) : (
                    usage.recentSessions.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="run-box"
                        onClick={() => router.push(`/chat/${s.agent_id}?session=${s.anthropic_session_id}`)}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 600 }}>
                          <span className="run-dot" />
                          {s.agentName}
                        </span>
                        <span className="mono-num" style={{ color: "var(--text-secondary)" }}>
                          {fmtDate(s.created_at)} · {fmtTime(s.created_at)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* ── rechts: Lagebild ── */}
              <aside className="rail">
                <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Dein Aufbau</span>
                <div style={{ margin: "0 auto" }}>
                  <Orbital
                    depts={orbitalDepts}
                    size={350}
                    coreR={29}
                    rInner={75}
                    rOuter={112}
                    spread={40}
                    activeDept={activeDept}
                    onDeptChange={(id) => { setActiveDept(id as AbteilungId); setSelectedAgent(null); }}
                    selectedAgent={selectedAgent}
                    onAgentSelect={setSelectedAgent}
                    showLabels={false}
                    nodeSize={11}
                    nodePad="6px 11px"
                    coreFontSize={11}
                    markOwned
                  />
                </div>

                <div className="rail__legend">
                  <span className="rail__legend-row">
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)" }} />
                    gebucht
                  </span>
                  <span className="rail__legend-row">
                    <span style={{ width: 9, height: 9, borderRadius: "50%", border: "1px solid rgba(20,24,26,0.35)", boxSizing: "border-box" }} />
                    verfügbar, nicht gebucht
                  </span>
                </div>

                {upsell && (
                  <div className="upsell">
                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                      {upsell.name} dazunehmen
                    </span>
                    <span className="t-meta" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>
                      {upsell.eintraege.length} {upsell.eintraege.length === 1 ? "Agent" : "Agents"}
                      {upsellAbPreis > 0 && `, ab ${upsellAbPreis} €/Monat`}. Setup in wenigen Tagen.
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { setActiveDept(upsell.id); setSelectedAgent(null); }}
                    >
                      Abteilung ansehen
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}

        {/* ══════════════════ VERLAUF ══════════════════ */}
        {view === "history" && (
          <>
            <div className="portal-welcome">
              <div>
                <h2>Verlauf</h2>
                <p>Alle Sitzungen deines Kontos. Ein Klick führt zurück in den Chat.</p>
              </div>
              <span className="mono-num" style={{ color: "var(--text-muted)" }}>
                {usage.recentSessions.length} Sitzungen
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--hairline)" }}>
              <div className="table-head" style={{ gridTemplateColumns: "1fr 200px 140px 130px" }}>
                <span>Sitzung</span><span>Agent</span><span>Datum</span>
                <span style={{ textAlign: "right" }}>Aktion</span>
              </div>
              {usage.recentSessions.length === 0 ? (
                <div className="table-empty">Noch keine Sitzung gestartet.</div>
              ) : (
                usage.recentSessions.map((s) => (
                  <div key={s.id} className="table-row" style={{ gridTemplateColumns: "1fr 200px 140px 130px" }}>
                    <span className="mono-num" style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.anthropic_session_id}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{s.agentName}</span>
                    <span className="mono-num" style={{ color: "var(--text-muted)" }}>
                      {fmtDate(s.created_at)} · {fmtTime(s.created_at)}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <button
                        className="btn-buy"
                        onClick={() => router.push(`/chat/${s.agent_id}?session=${s.anthropic_session_id}`)}
                      >
                        Öffnen
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ══════════════════ VERBRAUCH ══════════════════ */}
        {view === "usage" && (
          <>
            <div className="portal-welcome">
              <div>
                <h2>Verbrauch</h2>
                <p>Sitzungen, Kontingent und Verteilung über deine Agents.</p>
              </div>
            </div>

            <div className="portal-section">
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label-small">Sitzungen diesen Monat</div>
                  <div className="stat-val">{usedThisMonth}</div>
                  <div className="stat-change">von {MONTHLY_LIMIT} inkludiert</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label-small">Vormonat</div>
                  <div className="stat-val">{usage.totalLastMonth}</div>
                  <div className={`stat-change${usedThisMonth < usage.totalLastMonth ? " is-bad" : ""}`}>
                    {usedThisMonth - usage.totalLastMonth >= 0 ? "+" : ""}
                    {usedThisMonth - usage.totalLastMonth} gegenüber Vormonat
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label-small">Verbleibend</div>
                  <div className="stat-val">{remaining}</div>
                  <div className={`stat-change${remaining < 10 ? " is-bad" : ""}`}>Sitzungen bis Monatsende</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label-small">Geschätzte Kosten</div>
                  <div className="stat-val">{estimatedCost !== null ? fmtEur(estimatedCost) : "—"}</div>
                  <div className="stat-change">
                    {totalMonthly > 0 ? `anteilig von ${fmtEur(totalMonthly)}` : "Abo-Daten unter Abrechnung"}
                  </div>
                </div>
              </div>

              {/* Verlauf zuerst: die Frage "laeuft da was und wie viel"
                  beantwortet eine Kurve schneller als vier Kennzahlen. */}
              <div style={{ marginBottom: 24 }}>
                <Verlaufsdiagramm punkte={usage.verlauf} />
              </div>

              <div className="stat-card" style={{ marginBottom: 24 }}>
                <div className="stat-label-small">Freikontingent</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="stat-val">{usedThisMonth} / {MONTHLY_LIMIT}</span>
                  <span className="mono-num" style={{ color: "var(--text-muted)" }}>{usedPct} %</span>
                </div>
                <div className="progress">
                  <div className={`progress__fill${usedPct > 80 ? " is-bad" : ""}`} style={{ width: `${usedPct}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span className="mono-num" style={{ color: "var(--text-muted)" }}>verbraucht</span>
                  <span className="mono-num" style={{ color: "var(--text-muted)" }}>Reset am 1. des Monats</span>
                </div>
              </div>

              {usage.stats.length > 0 && (
                <div className="stat-card">
                  <div className="stat-label-small">Verbrauch je Agent</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 4 }}>
                    {usage.stats.map((stat) => {
                      const pct = Math.min(100, Math.round((stat.totalSessions / Math.max(1, usedThisMonth)) * 100));
                      const diff = stat.sessionsThisWeek - stat.sessionsLastWeek;
                      return (
                        <div key={stat.agentId}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 16 }}>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{stat.agentName}</span>
                            <span className="mono-num" style={{ color: "var(--text-muted)" }}>
                              {stat.totalSessions} gesamt · {diff >= 0 ? "+" : ""}{diff} diese Woche
                            </span>
                          </div>
                          <div className="progress" style={{ height: 5 }}>
                            <div className="progress__fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════ ABRECHNUNG ══════════════════ */}
        {view === "billing" && (
          <>
            <div className="portal-welcome">
              <div>
                <h2>Abrechnung</h2>
                <p>Laufende Abos, Zahlungsweise und Rechnungen.</p>
              </div>
              <button className="btn btn-primary" onClick={openBillingPortal} disabled={portalLoading}>
                {portalLoading ? "Öffne Portal…" : "Abo & Rechnungen verwalten →"}
              </button>
            </div>

            <div className="portal-section">
              {billingLoading ? (
                <div className="table-empty">
                  <span className="spinner" style={{ margin: "0 auto 16px" }} /> Lade Abo-Daten…
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="card">
                  <div className="portal-section-title" style={{ marginBottom: 8 }}>Kein aktives Abo</div>
                  <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "60ch", marginBottom: 20 }}>
                    Sobald du einen Agenten gebucht hast, stehen hier Abo, Zahlungsweise und Rechnungen.
                  </p>
                  <button className="btn btn-outline" onClick={() => setView("agents")}>Agents ansehen</button>
                </div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: 16, padding: 0 }}>
                    <div className="table-head" style={{ gridTemplateColumns: "1fr 180px 180px 120px", paddingLeft: 24, paddingRight: 24 }}>
                      <span>Abo</span><span>Zeitraum</span><span>Nächste Zahlung</span>
                      <span style={{ textAlign: "right" }}>Betrag</span>
                    </div>
                    {subscriptions.map((sub) => (
                      <div key={sub.id} className="table-row" style={{ gridTemplateColumns: "1fr 180px 180px 120px", paddingLeft: 24, paddingRight: 24 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{sub.planName}</span>
                          <span className={sub.cancelAtPeriodEnd ? "badge badge-outline" : "badge badge-solid"}>
                            {sub.cancelAtPeriodEnd ? "endet bald" : "aktiv"}
                          </span>
                        </span>
                        <span className="mono-num" style={{ color: "var(--text-secondary)" }}>
                          {fmtDate(sub.currentPeriodStart)} – {fmtDate(sub.currentPeriodEnd)}
                        </span>
                        <span className="mono-num" style={{ color: "var(--text-secondary)" }}>
                          {sub.cancelAtPeriodEnd ? "keine" : fmtDate(sub.currentPeriodEnd)}
                        </span>
                        <span className="mono-num" style={{ textAlign: "right", color: "var(--text-primary)" }}>
                          {fmtEur(sub.priceEur)}/{sub.interval === "month" ? "Mon." : "Jahr"}
                        </span>
                      </div>
                    ))}
                    <div className="table-row" style={{ gridTemplateColumns: "1fr 180px 180px 120px", paddingLeft: 24, paddingRight: 24, background: "rgba(31,75,69,0.04)", borderBottom: "none" }}>
                      <span style={{ fontWeight: 700 }}>Summe</span><span /><span />
                      <span className="mono-num" style={{ textAlign: "right", fontWeight: 500 }}>{fmtEur(totalMonthly)}</span>
                    </div>
                  </div>

                  <div className="card">
                    <div className="stat-label-small">Hinweis</div>
                    <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "70ch" }}>
                      Dein Abo ist ein Festpreis — du zahlst jeden Monat denselben Betrag, unabhängig von
                      der Nutzung. Was du davon verbraucht hast, steht unter Verbrauch. Bei Fragen zur
                      Rechnung:{" "}
                      <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--accent)", fontWeight: 600 }}>{SUPPORT_EMAIL}</a>
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <footer className="landing-footer" style={{ marginTop: "auto" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <KanaMark size={18} />
            <span>© {new Date().getFullYear()} KANA AI</span>
          </span>
          {/* Der alte "Einstellungen"-Punkt in der Seitenleiste hatte keinen
              Handler und fuehrte nirgendwohin — deshalb hier nicht wieder
              aufgenommen. */}
          <span className="footer-links">
            <a href="/ki-transparenz">KI-Transparenz</a>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
          </span>
        </footer>
      </div>

      {/* ══ Onboarding ══ */}
      {showOnboarding && (
        <div className="trigger-modal" role="dialog" aria-modal="true" aria-label="Willkommen bei KANA AI">
          <div className="trigger-modal-content">
            <button onClick={dismissOnboarding} className="modal-close-btn"
              style={{ position: "absolute", top: 20, right: 20 }} aria-label="Schließen">
              <X size={20} />
            </button>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <KanaMark size={62} motion="spin" breathe />
              <h2 className="t-h3" style={{ marginTop: 8 }}>Willkommen bei KANA AI</h2>
              <p className="t-lead" style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: "46ch" }}>
                Deine Agents arbeiten in einem abgetrennten Bereich. Das übernehmen sie für dich.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
              {[
                { title: "Markt analysieren", desc: "Wettbewerb, Preise und Nachfrage — fortlaufend statt quartalsweise." },
                { title: "Creatives erstellen", desc: "Anzeigen und Inhalte aus deinem vorhandenen Material." },
                { title: "Kampagnen schalten", desc: "Auf den passenden Kanälen, im abgestimmten Budget." },
              ].map((f) => (
                <div key={f.title} className="card-flat" style={{ padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, letterSpacing: "-0.02em" }}>{f.title}</div>
                  <div className="t-meta" style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={dismissOnboarding}>
              Portal öffnen <ArrowRight size={16} />
            </button>
            <p className="t-meta" style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 14 }}>
              Bei Fragen: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--accent)" }}>{SUPPORT_EMAIL}</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
