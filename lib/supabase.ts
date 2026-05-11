import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client (für Frontend & sichere Server-Calls) ───────────────────

// Öffentlicher Client (für Frontend - nur lesend, was erlaubt ist)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin Client (nur auf dem Server verwenden! - hat vollen Zugriff)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Typen für unsere Datenbank ───────────────────────────────────────────────

export type AgentAccess = {
  id: string;
  user_id: string;       // Clerk User ID
  agent_id: string;      // Anthropic Managed Agent ID
  agent_name: string;    // Anzeigename für den Kunden
  agent_description: string;
  purchased_at: string;
  is_active: boolean;
};

export type Session = {
  id: string;
  user_id: string;
  agent_id: string;
  anthropic_session_id: string;  // ID von Anthropic
  created_at: string;
  last_message_at: string;
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Prüft ob ein Benutzer Zugang zu einem bestimmten Agent hat
 * Wird vom Backend aufgerufen bevor ein API-Call gemacht wird
 */
export async function checkAgentAccess(
  userId: string,
  agentId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("agent_access")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", agentId)
    .eq("is_active", true)
    .single();

  if (error || !data) return false;
  return true;
}

/**
 * Gibt alle Agents zurück, die ein Benutzer gekauft hat
 */
export async function getUserAgents(userId: string): Promise<AgentAccess[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_access")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("purchased_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

/**
 * Schaltet nach erfolgreichem Stripe-Kauf den Agent-Zugang frei
 */
export async function grantAgentAccess(
  userId: string,
  agentId: string,
  agentName: string,
  agentDescription: string
): Promise<void> {
  await supabaseAdmin.from("agent_access").upsert({
    user_id: userId,
    agent_id: agentId,
    agent_name: agentName,
    agent_description: agentDescription,
    is_active: true,
    purchased_at: new Date().toISOString(),
  });
}

/**
 * Speichert eine neue Agent-Session in der DB
 */
export async function saveSession(
  userId: string,
  agentId: string,
  anthropicSessionId: string
): Promise<void> {
  await supabaseAdmin.from("sessions").insert({
    user_id: userId,
    agent_id: agentId,
    anthropic_session_id: anthropicSessionId,
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  });
}
