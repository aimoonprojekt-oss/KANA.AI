import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { upsertAgent } from "@/lib/supabase";

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
  // Falls ADMIN_USER_IDS nicht gesetzt ist, darf jeder eingeloggte User syncen
  if (adminIds.length === 0) return true;
  return adminIds.includes(userId);
}

/**
 * POST /api/admin/sync-agents
 *
 * Liest alle Master-Agents aus der Anthropic Console und schreibt/aktualisiert
 * sie in der Supabase `agents` Tabelle.
 *
 * Fixes:
 * - ANTHROPIC_ENVIRONMENT_ID ist optional (wird aus API-Antwort gelesen)
 * - Paginierung: iteriert alle Seiten via for-await (auto-pagination)
 * - Kundenkopien werden zuverlässig übersprungen
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
    // ── Alle Agents laden (auto-paginiert) ──────────────────────────────────
    const agentList: Record<string, unknown>[] = [];

    try {
      // Anthropic SDK unterstützt async iteration für paginierte Listen
      for await (const agent of beta.agents.list()) {
        agentList.push(agent as Record<string, unknown>);
      }
    } catch {
      // Fallback: erste Seite direkt auslesen
      const resp = await beta.agents.list();
      const page: Record<string, unknown>[] =
        resp?.data ??
        resp?.agents ??
        (Array.isArray(resp) ? resp : []);
      agentList.push(...page);
    }

    console.log(`[sync-agents] ${agentList.length} Agent(en) aus Anthropic Console geladen`);

    if (agentList.length === 0) {
      return NextResponse.json({
        message: "Keine Agents in der Anthropic Console gefunden. Prüfe ob ANTHROPIC_API_KEY korrekt ist und Agents existieren.",
        synced: [],
      });
    }

    // Fallback environment_id: aus dem ersten Agent lesen oder Env-Var nutzen
    const fallbackEnvId =
      process.env.ANTHROPIC_ENVIRONMENT_ID ??
      (agentList[0]?.environment_id as string) ??
      "default";

    const synced:  { id: string; name: string }[] = [];
    const skipped: string[]                         = [];
    const errors:  string[]                         = [];

    for (const agent of agentList) {
      const agentId   = (agent.id   ?? agent.agent_id   ?? "") as string;
      const agentName = (agent.name ?? agent.display_name ?? agentId) as string;

      if (!agentId) {
        errors.push(`Agent ohne ID übersprungen: ${JSON.stringify(agent)}`);
        continue;
      }

      // Kundenkopien überspringen (Name enthält " — user_xxxxx" oder "TEST_COPY")
      if (/ — user_\w+/.test(agentName) || agentName.startsWith("TEST_COPY_DELETE_ME")) {
        console.log(`[sync-agents] Kundenkopie übersprungen: ${agentName}`);
        skipped.push(agentName);
        continue;
      }

      try {
        await upsertAgent({
          anthropic_agent_id: agentId,
          environment_id:     (agent.environment_id as string) ?? fallbackEnvId,
          name:               agentName,
          slug:               slugify(agentName),
          description:        (agent.description as string) ?? undefined,
          // Kategorie: aus metadata.category, oder direkt agent.category
          category:
            (agent as Record<string, Record<string, unknown>>).metadata?.category as string ??
            (agent.category as string) ??
            undefined,
        });
        synced.push({ id: agentId, name: agentName });
        console.log(`[sync-agents] ✓ ${agentName} (${agentId})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sync-agents] ✗ ${agentName}:`, msg);
        errors.push(`${agentName}: ${msg}`);
      }
    }

    return NextResponse.json({
      message: `${synced.length} Agent(en) synchronisiert.${
        skipped.length > 0 ? ` ${skipped.length} Kundenkopie(n) übersprungen.` : ""
      }${errors.length > 0 ? ` ${errors.length} Fehler.` : ""}`,
      synced,
      skipped: skipped.length > 0 ? skipped : undefined,
      errors:  errors.length  > 0 ? errors  : undefined,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("[sync-agents] Kritischer Fehler:", error);
    return NextResponse.json({ message: msg, detail: String(error) }, { status: 500 });
  }
}
