import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Clients (lazy) ───────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env-Var '${name}' fehlt. In Vercel unter Settings → Environment Variables setzen.`);
  return v;
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) _supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  return _supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  return _supabaseAdmin;
}

export const supabase = new Proxy({} as SupabaseClient, { get: (_t, p) => Reflect.get(getSupabase(), p) });
export const supabaseAdmin = new Proxy({} as SupabaseClient, { get: (_t, p) => Reflect.get(getSupabaseAdmin(), p) });

// ═══════════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Zentraler Agent-Katalog aus der `agents` Tabelle */
export type DBAgent = {
  id:                 string;   // uuid
  anthropic_agent_id: string;   // z.B. "agent_01G2ceo..."
  environment_id:     string;   // Anthropic Environment ID
  name:               string;
  slug:               string;   // URL-freundlicher Name (unique)
  description:        string | null;
  category:           string | null;  // "research" | "sales" | "marketing" etc.
  thumbnail_url:      string | null;
  price_eur:          number;   // Preis in Euro (z.B. 49 = €49/Monat)
  published:          boolean;  // Sichtbar auf Website?
  featured:           boolean;  // Hervorgehoben?
  created_at:         string;
};

/** Zugang eines Users zu einem Agent (alte Tabelle, weiterhin genutzt) */
export type AgentAccess = {
  id:               string;
  user_id:          string;  // Clerk user_id
  agent_id:         string;  // = anthropic_agent_id
  agent_name:       string;
  agent_description:string;
  purchased_at:     string;
  is_active:        boolean;
};

/** Chat-Session */
export type Session = {
  id:                   string;
  user_id:              string;
  agent_id:             string;
  anthropic_session_id: string;
  created_at:           string;
  last_message_at:      string;
};

/** Einzelner Run (Task-Ausführung) */
export type Run = {
  id:              string;
  session_id:      string | null;
  organization_id: string | null;
  status:          "created" | "running" | "completed" | "failed";
  anthropic_run_id:string | null;
  input_prompt:    string | null;
  output_summary:  string | null;
  started_at:      string | null;
  completed_at:    string | null;
  created_at:      string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS — Katalog
// ═══════════════════════════════════════════════════════════════════════════════

/** Alle veröffentlichten Agents — für Landing Page (öffentlich) */
export async function getPublishedAgents(): Promise<DBAgent[]> {
  const { data } = await getSupabaseAdmin()
    .from("agents")
    .select("*")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("created_at");
  return data ?? [];
}

/** Alle Agents (auch unveröffentlichte) — für Admin */
export async function getAllAgents(): Promise<DBAgent[]> {
  const { data } = await getSupabaseAdmin()
    .from("agents")
    .select("*")
    .order("created_at");
  return data ?? [];
}

/** Agent per Anthropic-ID laden */
export async function getDBAgentById(anthropicAgentId: string): Promise<DBAgent | null> {
  const { data } = await getSupabaseAdmin()
    .from("agents")
    .select("*")
    .eq("anthropic_agent_id", anthropicAgentId)
    .single();
  return data ?? null;
}

/** Agents, auf die ein User Zugang hat (mit vollem Katalog-Info) */
export async function getUserAccessedAgents(userId: string): Promise<DBAgent[]> {
  const { data: access } = await getSupabaseAdmin()
    .from("agent_access")
    .select("agent_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!access || access.length === 0) return [];
  const ids = access.map((a) => a.agent_id);

  const { data: agents } = await getSupabaseAdmin()
    .from("agents")
    .select("*")
    .in("anthropic_agent_id", ids);

  return agents ?? [];
}

/** Veröffentlichte Agents, die der User noch NICHT gekauft hat (für Locked-Karten) */
export async function getLockedAgentsForUser(userId: string): Promise<DBAgent[]> {
  const { data: access } = await getSupabaseAdmin()
    .from("agent_access")
    .select("agent_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const purchasedIds = (access ?? []).map((a) => a.agent_id);

  const { data: allPublished } = await getSupabaseAdmin()
    .from("agents")
    .select("*")
    .eq("published", true);

  return (allPublished ?? []).filter(
    (a) => !purchasedIds.includes(a.anthropic_agent_id)
  );
}

/** Agent aus Anthropic-Sync in DB schreiben (upsert) */
export async function upsertAgent(agent: {
  anthropic_agent_id: string;
  environment_id:     string;
  name:               string;
  slug:               string;
  description?:       string;
  category?:          string;
}): Promise<void> {
  await getSupabaseAdmin()
    .from("agents")
    .upsert(agent, { onConflict: "anthropic_agent_id" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT ACCESS — Zugangskontrolle
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkAgentAccess(userId: string, agentId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("agent_access")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .single();
  return !error && !!data;
}

export async function getUserAgents(userId: string): Promise<AgentAccess[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("agent_access")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("purchased_at", { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function grantAgentAccess(
  userId: string,
  agentId: string,
  agentName: string,
  agentDescription: string
): Promise<void> {
  await getSupabaseAdmin().from("agent_access").upsert({
    user_id:           userId,
    agent_id:          agentId,
    agent_name:        agentName,
    agent_description: agentDescription,
    is_active:         true,
    purchased_at:      new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveSession(
  userId:              string,
  agentId:             string,
  anthropicSessionId:  string
): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from("sessions")
    .insert({
      user_id:              userId,
      agent_id:             agentId,
      anthropic_session_id: anthropicSessionId,
      created_at:           new Date().toISOString(),
      last_message_at:      new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id ?? "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNS — Task-Tracking
// ═══════════════════════════════════════════════════════════════════════════════

export async function createRun(sessionId: string, inputPrompt: string): Promise<string> {
  const { data } = await getSupabaseAdmin()
    .from("runs")
    .insert({
      session_id:   sessionId,
      status:       "created",
      input_prompt: inputPrompt,
      started_at:   new Date().toISOString(),
      created_at:   new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id ?? "";
}

export async function completeRun(runId: string, outputSummary?: string): Promise<void> {
  if (!runId) return;
  await getSupabaseAdmin()
    .from("runs")
    .update({
      status:         "completed",
      output_summary: outputSummary ?? null,
      completed_at:   new Date().toISOString(),
    })
    .eq("id", runId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE STATS — für Verlauf-Tab
// ═══════════════════════════════════════════════════════════════════════════════

export type UsageStat = {
  agentId:          string;
  agentName:        string;
  totalSessions:    number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
};

export type UsageOverview = {
  stats:           UsageStat[];
  totalThisMonth:  number;
  totalLastMonth:  number;
  recentSessions:  (Session & { agentName: string })[];
};

export async function getUserUsageStats(userId: string): Promise<UsageOverview> {
  const { data: sessions } = await getSupabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: agents } = await getSupabaseAdmin()
    .from("agent_access")
    .select("agent_id, agent_name")
    .eq("user_id", userId);

  const agentMap = new Map((agents ?? []).map((a) => [a.agent_id, a.agent_name]));

  const now               = new Date();
  const startOfThisWeek   = new Date(now); startOfThisWeek.setDate(now.getDate() - now.getDay()); startOfThisWeek.setHours(0,0,0,0);
  const startOfLastWeek   = new Date(startOfThisWeek); startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfThisMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const agentStats = new Map<string, UsageStat>();
  for (const s of sessions ?? []) {
    const created = new Date(s.created_at);
    if (!agentStats.has(s.agent_id)) {
      agentStats.set(s.agent_id, { agentId: s.agent_id, agentName: agentMap.get(s.agent_id) ?? "Unbekannt", totalSessions: 0, sessionsThisWeek: 0, sessionsLastWeek: 0 });
    }
    const stat = agentStats.get(s.agent_id)!;
    stat.totalSessions++;
    if (created >= startOfThisWeek)      stat.sessionsThisWeek++;
    else if (created >= startOfLastWeek) stat.sessionsLastWeek++;
  }

  const totalThisMonth = (sessions ?? []).filter((s) => new Date(s.created_at) >= startOfThisMonth).length;
  const totalLastMonth = (sessions ?? []).filter((s) => { const d = new Date(s.created_at); return d >= startOfLastMonth && d < startOfThisMonth; }).length;

  return {
    stats:          Array.from(agentStats.values()),
    totalThisMonth,
    totalLastMonth,
    recentSessions: (sessions ?? []).slice(0, 15).map((s) => ({ ...s, agentName: agentMap.get(s.agent_id) ?? "Unbekannt" })),
  };
}
