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
  id:                 string;   // uuid (PK in agents-Tabelle)
  anthropic_agent_id: string;   // z.B. "agent_01G2ceo..."
  environment_id:     string;
  name:               string;
  slug:               string;
  description:        string | null;
  category:           string | null;
  thumbnail_url:      string | null;
  price_eur:          number;
  published:          boolean;
  featured:           boolean;
  stripe_price_id:    string | null;  // Stripe Price ID (price_xxx)
  created_at:         string;
};

/** Organisation — ein User hat genau eine Organisation */
export type Organization = {
  id:         string;   // uuid
  name:       string;
  user_id:    string;   // Clerk user_id (UNIQUE)
  created_at: string;
};

/** Chat-Session */
export type Session = {
  id:                   string;
  user_id:              string;
  agent_id:             string;   // = anthropic_agent_id
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
// ORGANISATIONS — User ↔ Organisation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Organisation für einen Clerk-User laden oder automatisch anlegen.
 * Jeder User hat genau eine Organisation (1:1).
 * Voraussetzung: `ALTER TABLE organizations ADD COLUMN user_id text UNIQUE;`
 */
export async function getOrCreateOrganization(userId: string): Promise<string> {
  const db = getSupabaseAdmin();

  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  // Neu anlegen
  const { data: created, error } = await db
    .from("organizations")
    .insert({ name: `org_${userId}`, user_id: userId })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Organisation konnte nicht erstellt werden: ${error?.message}`);
  return created.id;
}

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
    .maybeSingle();
  return data ?? null;
}

/** Agents, auf die ein User Zugang hat — via agent_access1 + organizations */
export async function getUserAccessedAgents(userId: string): Promise<DBAgent[]> {
  const db = getSupabaseAdmin();

  // 1. Organisation des Users finden
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!org) return [];

  // 2. Zugänge aus agent_access1 laden (agent_id ist die agents.id UUID)
  const { data: access } = await db
    .from("agent_access1")
    .select("agent_id")
    .eq("organization_id", org.id)
    .eq("active", true);

  if (!access || access.length === 0) return [];
  const agentUuids = access.map((a) => a.agent_id).filter(Boolean);

  // 3. Vollständige Agent-Daten laden
  const { data: agents } = await db
    .from("agents")
    .select("*")
    .in("id", agentUuids);

  return agents ?? [];
}

/** Veröffentlichte Agents, die der User noch NICHT gekauft hat (für Locked-Karten) */
export async function getLockedAgentsForUser(userId: string): Promise<DBAgent[]> {
  const db = getSupabaseAdmin();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: access } = org
    ? await db.from("agent_access1").select("agent_id").eq("organization_id", org.id).eq("active", true)
    : { data: [] };

  const purchasedUuids = new Set((access ?? []).map((a) => a.agent_id).filter(Boolean));

  const { data: allPublished } = await db
    .from("agents")
    .select("*")
    .eq("published", true);

  return (allPublished ?? []).filter((a) => !purchasedUuids.has(a.id));
}

/** Agent aus Anthropic-Sync in DB schreiben (insert oder update) */
export async function upsertAgent(agent: {
  anthropic_agent_id: string;
  environment_id:     string;
  name:               string;
  slug:               string;
  description?:       string;
  category?:          string;
}): Promise<void> {
  const db = getSupabaseAdmin();

  const { data: existing } = await db
    .from("agents")
    .select("id")
    .eq("anthropic_agent_id", agent.anthropic_agent_id)
    .maybeSingle();

  if (existing) {
    // Update — published/featured/price_eur bleiben unangetastet
    const { error } = await db
      .from("agents")
      .update({
        environment_id: agent.environment_id,
        name:           agent.name,
        slug:           agent.slug,
        description:    agent.description ?? null,
        category:       agent.category ?? null,
      })
      .eq("anthropic_agent_id", agent.anthropic_agent_id);
    if (error) throw new Error(`Update fehlgeschlagen: ${error.message}`);
  } else {
    const { error } = await db
      .from("agents")
      .insert({
        ...agent,
        description: agent.description ?? null,
        category:    agent.category ?? null,
        published:   false,
        featured:    false,
        price_eur:   0,
      });
    if (error) throw new Error(`Insert fehlgeschlagen: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT ACCESS — Zugangskontrolle via agent_access1
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prüft ob ein User Zugang zu einem Agent hat.
 * @param userId          Clerk user_id
 * @param anthropicAgentId  anthropic_agent_id (z.B. "agent_01G2...")
 */
export async function checkAgentAccess(userId: string, anthropicAgentId: string): Promise<boolean> {
  const db = getSupabaseAdmin();

  // Organisation des Users finden
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!org) return false;

  // agents.id (UUID) aus anthropic_agent_id ermitteln
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("anthropic_agent_id", anthropicAgentId)
    .maybeSingle();

  if (!agent) return false;

  // Zugang prüfen
  const { data, error } = await db
    .from("agent_access1")
    .select("id")
    .eq("organization_id", org.id)
    .eq("agent_id", agent.id)
    .eq("active", true)
    .maybeSingle();

  return !error && !!data;
}

/**
 * Schaltet einem User Zugang zu einem Agent frei (z.B. nach Stripe-Kauf).
 * Speichert die Kunden-spezifische Anthropic Agent-ID für Kostentrennung.
 * Erstellt automatisch eine Organisation falls noch keine vorhanden.
 *
 * @param userId                   Clerk user_id
 * @param masterAnthropicAgentId   anthropic_agent_id des Master-Agents
 * @param customerAnthropicAgentId anthropic_agent_id der Kundenkopie (nach Kauf erstellt)
 */
export async function grantAgentAccess(
  userId: string,
  masterAnthropicAgentId: string,
  customerAnthropicAgentId?: string,
  _agentName?: string,        // Legacy-Parameter, nicht mehr genutzt
  _agentDescription?: string  // Legacy-Parameter, nicht mehr genutzt
): Promise<void> {
  const db = getSupabaseAdmin();

  const orgId = await getOrCreateOrganization(userId);

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("anthropic_agent_id", masterAnthropicAgentId)
    .maybeSingle();

  if (!agent) throw new Error(`Agent nicht in DB gefunden: ${masterAnthropicAgentId}`);

  // Prüfen ob Zugang schon existiert
  const { data: existing } = await db
    .from("agent_access1")
    .select("id")
    .eq("organization_id", orgId)
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (existing) {
    // Bestehenden Eintrag aktualisieren (z.B. Kundenkopie nachträglich setzen)
    const { error } = await db
      .from("agent_access1")
      .update({
        active: true,
        ...(customerAnthropicAgentId && { customer_anthropic_agent_id: customerAnthropicAgentId }),
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Update fehlgeschlagen: ${error.message}`);
  } else {
    // Neuen Zugang anlegen
    const { error } = await db
      .from("agent_access1")
      .insert({
        organization_id:              orgId,
        agent_id:                     agent.id,
        active:                       true,
        purchased_at:                 new Date().toISOString(),
        customer_anthropic_agent_id:  customerAnthropicAgentId ?? null,
      });
    if (error) throw new Error(`Zugang konnte nicht gewährt werden: ${error.message}`);
  }
}

/**
 * Gibt die Kunden-spezifische Anthropic Agent-ID zurück.
 * Wird im Chat genutzt damit jeder Kunde seinen eigenen Agent verwendet.
 */
export async function getCustomerAgentId(
  userId: string,
  masterAnthropicAgentId: string
): Promise<string | null> {
  const db = getSupabaseAdmin();

  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!org) return null;

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("anthropic_agent_id", masterAnthropicAgentId)
    .maybeSingle();
  if (!agent) return null;

  const { data: access } = await db
    .from("agent_access1")
    .select("customer_anthropic_agent_id")
    .eq("organization_id", org.id)
    .eq("agent_id", agent.id)
    .eq("active", true)
    .maybeSingle();

  return access?.customer_anthropic_agent_id ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveSession(
  userId:              string,
  agentId:             string,   // anthropic_agent_id
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
  const db = getSupabaseAdmin();

  const { data: sessions } = await db
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Agent-Namen direkt aus der agents-Tabelle (via anthropic_agent_id)
  const agentIds = [...new Set((sessions ?? []).map((s) => s.agent_id))];
  const { data: agentRows } = agentIds.length > 0
    ? await db.from("agents").select("anthropic_agent_id, name").in("anthropic_agent_id", agentIds)
    : { data: [] };

  const agentMap = new Map((agentRows ?? []).map((a) => [a.anthropic_agent_id, a.name]));

  const now              = new Date();
  const startOfThisWeek  = new Date(now); startOfThisWeek.setDate(now.getDate() - now.getDay()); startOfThisWeek.setHours(0,0,0,0);
  const startOfLastWeek  = new Date(startOfThisWeek); startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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

  const totalThisMonth = (sessions ?? []).filter((s) => new Date(s.created_at) >= startOfThisMonth).length;
  const totalLastMonth = (sessions ?? []).filter((s) => {
    const d = new Date(s.created_at);
    return d >= startOfLastMonth && d < startOfThisMonth;
  }).length;

  return {
    stats:          Array.from(agentStats.values()),
    totalThisMonth,
    totalLastMonth,
    recentSessions: (sessions ?? []).slice(0, 15).map((s) => ({
      ...s,
      agentName: agentMap.get(s.agent_id) ?? "Unbekannt",
    })),
  };
}
