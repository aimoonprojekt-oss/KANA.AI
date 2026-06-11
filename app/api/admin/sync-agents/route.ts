import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { upsertAgent, getSupabaseAdmin } from "@/lib/platform/supabase";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.length === 0) return true;
  return adminIds.includes(userId);
}

/**
 * POST /api/admin/sync-agents
 *
 * Vollständige Synchronisation mit der Anthropic Console:
 * 1. Alle Master-Agents aus Anthropic laden (auto-paginiert)
 * 2. Neue Agents in Supabase einfügen / bestehende aktualisieren
 * 3. Agents die in Anthropic gelöscht wurden → in Supabase auf published=false setzen
 *    (Soft-Delete: Preis, Stripe-ID und Einstellungen bleiben erhalten)
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  if (!isAdmin(userId)) return NextResponse.json({ message: "Kein Zugriff — nur Admins." }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ message: "ANTHROPIC_API_KEY nicht gesetzt." }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  try {
    // ── 1. Alle Agents aus Anthropic Console laden (auto-paginiert) ──────────
    const agentList: Record<string, unknown>[] = [];

    try {
      for await (const agent of beta.agents.list()) {
        agentList.push(agent as Record<string, unknown>);
      }
    } catch {
      const resp = await beta.agents.list();
      const page: Record<string, unknown>[] =
        resp?.data ?? resp?.agents ?? (Array.isArray(resp) ? resp : []);
      agentList.push(...page);
    }

    console.log(`[sync-agents] ${agentList.length} Agent(en) aus Anthropic Console geladen`);

    // ── 2. Master-Agents filtern (Kundenkopien und Test-Agents überspringen) ─
    const masterAgents = agentList.filter((agent) => {
      const name = (agent.name ?? agent.display_name ?? "") as string;
      return !/ — user_\w+/.test(name) && !name.startsWith("TEST_COPY_DELETE_ME");
    });

    const anthropicIds = new Set(
      masterAgents.map((a) => (a.id ?? a.agent_id ?? "") as string).filter(Boolean)
    );

    const fallbackEnvId =
      process.env.ANTHROPIC_ENVIRONMENT_ID ??
      (masterAgents[0]?.environment_id as string) ??
      "default";

    const synced:     { id: string; name: string }[] = [];
    const skipped:    string[]                         = [];
    const errors:     string[]                         = [];

    // ── 3. Upsert: neue/geänderte Agents in Supabase schreiben ──────────────
    for (const agent of masterAgents) {
      const agentId   = (agent.id ?? agent.agent_id ?? "") as string;
      const agentName = (agent.name ?? agent.display_name ?? agentId) as string;

      if (!agentId) {
        errors.push(`Agent ohne ID übersprungen: ${JSON.stringify(agent)}`);
        continue;
      }

      try {
        await upsertAgent({
          anthropic_agent_id: agentId,
          environment_id:     (agent.environment_id as string) ?? fallbackEnvId,
          name:               agentName,
          slug:               slugify(agentName),
          description:        (agent.description as string) ?? undefined,
          category:
            (agent as Record<string, Record<string, unknown>>).metadata?.category as string ??
            (agent.category as string) ??
            undefined,
        });
        synced.push({ id: agentId, name: agentName });
        console.log(`[sync-agents] ✓ upsert: ${agentName}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sync-agents] ✗ ${agentName}:`, msg);
        errors.push(`${agentName}: ${msg}`);
      }
    }

    // ── 4. Soft-Delete: Agents die in Anthropic gelöscht wurden ─────────────
    //    → published=false setzen (Einstellungen wie Preis bleiben erhalten)
    const db = getSupabaseAdmin();

    const { data: supabaseAgents } = await db
      .from("agents")
      .select("anthropic_agent_id, name, published")
      .not("anthropic_agent_id", "is", null);

    const unpublished: string[] = [];

    for (const row of supabaseAgents ?? []) {
      const isInConsole = anthropicIds.has(row.anthropic_agent_id);
      // War der Agent vorher published und ist jetzt weg → auf false setzen
      if (!isInConsole && row.published) {
        await db
          .from("agents")
          .update({ published: false })
          .eq("anthropic_agent_id", row.anthropic_agent_id);
        unpublished.push(row.name ?? row.anthropic_agent_id);
        console.log(`[sync-agents] ↓ unpublished (nicht mehr in Console): ${row.name}`);
      }
    }

    // Skipped zählen (Kundenkopien)
    for (const agent of agentList) {
      const name = (agent.name ?? agent.display_name ?? "") as string;
      if (/ — user_\w+/.test(name) || name.startsWith("TEST_COPY_DELETE_ME")) {
        skipped.push(name);
      }
    }

    return NextResponse.json({
      message: [
        `${synced.length} Agent(en) synchronisiert.`,
        unpublished.length > 0 ? `${unpublished.length} Agent(en) deaktiviert (nicht mehr in Console).` : "",
        skipped.length > 0 ? `${skipped.length} Kundenkopie(n) übersprungen.` : "",
        errors.length > 0 ? `${errors.length} Fehler.` : "",
      ].filter(Boolean).join(" "),
      synced,
      unpublished: unpublished.length > 0 ? unpublished : undefined,
      skipped:     skipped.length > 0     ? skipped     : undefined,
      errors:      errors.length > 0      ? errors      : undefined,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[sync-agents] Kritischer Fehler:", error);
    return NextResponse.json({ message: msg, detail: String(error) }, { status: 500 });
  }
}
