import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAgents } from "@/lib/supabase";

// ── KANA Logo ──────────────────────────────────────────────────────────────────
function KanaLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <defs>
        <linearGradient id="g-side" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333ea" /><stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="9" fill="url(#g-side)" />
      <rect x="9.5" y="8" width="2.8" height="18" rx="1.4" fill="white" />
      <path d="M12.3 17L22 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.3 17L22 25.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const GridIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const LogoutIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const PlayIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;

// ── Dept-Farben ───────────────────────────────────────────────────────────────
function deptColor(name: string) {
  if (name.toLowerCase().includes("marketing")) return "#a78bfa";
  if (name.toLowerCase().includes("sales")) return "#34d399";
  if (name.toLowerCase().includes("research")) return "#60a5fa";
  if (name.toLowerCase().includes("content")) return "#f472b6";
  return "#a78bfa";
}

// ── Dashboard (Server Component) ──────────────────────────────────────────────
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const agents = await getUserAgents(userId);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : (user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress?.[0] ?? "?").toUpperCase();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses[0]?.emailAddress ?? "Nutzer";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="kana-logo">
            <KanaLogo size={30} />
            <div className="kana-wordmark">KANA <em>AI</em></div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Übersicht</div>
            <button className="nav-item active">
              <span className="nav-icon"><GridIcon /></span>
              Meine Agents
              {agents.length > 0 && <span className="nav-badge">{agents.length}</span>}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Konto</div>
            <SignOutButton redirectUrl="/sign-in">
              <button className="nav-item" style={{ color: "var(--red)", width: "100%" }} type="button">
                <span className="nav-icon"><LogoutIcon /></span>
                Abmelden
              </button>
            </SignOutButton>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-pill">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-plan">Pro Plan · aktiv</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Hauptbereich ── */}
      <div className="app-right">
        {/* Top Bar */}
        <div className="top-bar">
          <div className="top-bar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Agents durchsuchen…
          </div>
          <div className="top-bar-right">
            <a href="https://platform.claude.com" target="_blank" className="btn btn-outline btn-sm">
              + Agent hinzufügen
            </a>
          </div>
        </div>

        <main className="main-content">
          <div className="page-header">
            <div>
              <div className="page-title">Meine Agents</div>
              <div className="page-subtitle">
                {agents.length} aktive {agents.length === 1 ? "Agent" : "Agents"} · jederzeit einsatzbereit
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Aktive Agents</div>
              <div className="stat-val">{agents.length}</div>
              <div className="stat-sub">Verfügbar für dich</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Plattform</div>
              <div className="stat-val" style={{ fontSize: 20 }}>KANA AI</div>
              <div className="stat-sub">Powered by Claude</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Modell</div>
              <div className="stat-val" style={{ fontSize: 18 }}>Sonnet 4.6</div>
              <div className="stat-sub">Frontier Intelligence</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ø Antwortzeit</div>
              <div className="stat-val">~3s</div>
              <div className="stat-sub">Pro Agent-Anfrage</div>
            </div>
          </div>

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "80px 20px",
              background: "var(--surface)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Noch keine Agents verfügbar</h2>
              <p style={{ color: "var(--text2)", marginBottom: 24, fontSize: 14 }}>
                Du hast noch keinen Agent erworben. Besuche unseren Shop.
              </p>
              <a href="https://euer-stripe-checkout-link.com"
                style={{ background: "linear-gradient(135deg,#9333ea,#1d4ed8)", color: "white", padding: "12px 28px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
                Agents kaufen →
              </a>
            </div>
          ) : (
            <div className="agents-grid">
              {agents.map((agent) => (
                <Link key={agent.id} href={`/chat/${agent.agent_id}`} style={{ display: "contents" }}>
                  <div className="agent-card">
                    <div className="agent-card-header">
                      <div>
                        <div className="agent-dept">
                          <span className="agent-dept-dot" style={{ background: deptColor(agent.agent_name) }} />
                          KI-Agent
                        </div>
                        <div className="agent-name">{agent.agent_name}</div>
                      </div>
                      <span className="badge badge-green">
                        <span className="dot dot-green" />Bereit
                      </span>
                    </div>

                    <div className="agent-desc">{agent.agent_description}</div>

                    <div className="agent-meta">
                      <div className="agent-meta-item">
                        Erworben: <span>{new Date(agent.purchased_at).toLocaleDateString("de-DE")}</span>
                      </div>
                    </div>

                    <div className="agent-actions">
                      <div className="agent-runs">Klicke um zu starten</div>
                      <button className="btn-trigger">
                        <PlayIcon /> Chat starten
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
