import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Supabase Clients (lazy initialisiert) ───────────────────────────────────
// Wir initialisieren NICHT auf Modul-Ebene mit `process.env.X!`, weil das
// während des Vercel-Build-Prerenders sofort wirft, wenn auch nur eine Variable
// fehlt. Stattdessen erstellen wir den Client beim ersten echten Aufruf.

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Environment Variable '${name}' fehlt. In Vercel unter Settings → Environment Variables setzen.`
    );
  }
  return v;
}

// Öffentlicher Client (Frontend / serverseitig OK)
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );
  }
  return _supabase;
}

// Admin Client — NUR auf dem Server verwenden (hat Service-Role-Berechtigung)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );
  }
  return _supabaseAdmin;
}

// Backwards-Kompat: alte Importe `import { supabase, supabaseAdmin } from ...`
// funktionieren weiter, aber nur, wenn die Env-Vars gesetzt sind.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_t, prop) => Reflect.get(getSupabase(), prop),
});
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_t, prop) => Reflect.get(getSupabaseAdmin(), prop),
});

// ─── Typen für unsere Datenbank ───────────────────────────────────────────────

export type AgentAccess = {
  id: string;
  user_id: string;
  agent_id: string;
  agent_name: string;
  agent_description: string;
  purchased_at: string;
  is_active: boolean;
};

export type Session = {
  id: string;
  user_id: string;
  agent_id: string;
  anthropic_session_id: string;
  created_at: string;
  last_message_at: string;
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

export async function checkAgentAccess(
  userId: string,
  agentId: string
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("agent_access")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .single();

  if (error || !data) return false;
  return true;
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
    user_id: userId,
    agent_id: agentId,
    agent_name: agentName,
    agent_description: agentDescription,
    is_active: true,
    purchased_at: new Date().toISOString(),
  });
}

export async function saveSession(
  userId: string,
  agentId: string,
  anthropicSessionId: string
): Promise<void> {
  await getSupabaseAdmin().from("sessions").insert({
    user_id: userId,
    agent_id: agentId,
    anthropic_session_id: anthropicSessionId,
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  });
}

// ─── Usage / Verlauf ──────────────────────────────────────────────────────────

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
  // Alle Sessions dieses Users laden
  const { data: sessions } = await getSupabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Agent-Namen aus agent_access holen
  const { data: agents } = await getSupabaseAdmin()
    .from("agent_access")
    .select("agent_id, agent_name")
    .eq("user_id", userId);

  const agentMap = new Map((agents ?? []).map(a => [a.agent_id, a.agent_name]));

  // Datumsgrenzen berechnen
  const now = new Date();

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Pro Agent aggregieren
  const agentStats = new Map<string, UsageStat>();

  for (const s of sessions ?? []) {
    const created = new Date(s.created_at);
    if (!agentStats.has(s.agent_id)) {
      agentStats.set(s.agent_id, {
        agentId:          s.agent_id,
        agentName:        agentMap.get(s.agent_id) ?? "Unbekannt",
        totalSessions:    0,
        sessionsThisWeek: 0,
        sessionsLastWeek: 0,
      });
    }
    const stat = agentStats.get(s.agent_id)!;
    stat.totalSessions++;
    if (created >= startOfThisWeek)      stat.sessionsThisWeek++;
    else if (created >= startOfLastWeek) stat.sessionsLastWeek++;
  }

  const totalThisMonth = (sessions ?? []).filter(s =>
    new Date(s.created_at) >= startOfThisMonth
  ).length;

  const totalLastMonth = (sessions ?? []).filter(s => {
    const d = new Date(s.created_at);
    return d >= startOfLastMonth && d < startOfThisMonth;
  }).length;

  const recentSessions = (sessions ?? []).slice(0, 15).map(s => ({
    ...s,
    agentName: agentMap.get(s.agent_id) ?? "Unbekannt",
  }));

  return {
    stats: Array.from(agentStats.values()),
    totalThisMonth,
    totalLastMonth,
    recentSessions,
  };
}
