import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { upsertAgent } from "@/lib/supabase";

export const runtime = "nodejs";

/** Wandelt einen beliebigen String in einen URL-tauglichen Slug um */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * POST /api/admin/sync-agents
 *
 * Liest alle Managed Agents aus der Anthropic Console und schreibt sie
 * per upsert in die `agents` Supabase-Tabelle.
 *
 * Schutz: Header `x-admin-secret` muss mit der Env-Variable ADMIN_SECRET
 * übereinstimmen (in Vercel setzen). Falls ADMIN_SECRET nicht gesetzt ist,
 * wird der Endpunkt trotzdem nur von Server-Code aufgerufen.
 */
export async function POST(req: NextRequest) {
  // ── Auth-Schutz: nur eingeloggte User dürfen syncen ────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  // Optionaler Admin-Secret-Check (falls ADMIN_SECRET in Vercel gesetzt ist)
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const providedSecret = req.headers.get("x-admin-secret");
    if (providedSecret !== adminSecret) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const environmentId = process.env.ANTHROPIC_ENVIRONMENT_ID;
  if (!environmentId) {
    return NextResponse.json(
      { message: "ANTHROPIC_ENVIRONMENT_ID nicht gesetzt." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  try {
    // ── Agents aus Anthropic Console laden ──────────────────────────────────
    const agentsResponse = await beta.agents.list();
    // SDK kann `{ data: [...] }` oder direkt ein Array zurückgeben
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentList: any[] = agentsResponse?.data ?? agentsResponse ?? [];

    const synced: string[] = [];
    const errors: string[] = [];

    for (const agent of agentList) {
      const agentId: string = agent.id ?? agent.agent_id ?? "";
      if (!agentId) continue;

      try {
        await upsertAgent({
          anthropic_agent_id: agentId,
          environment_id:     agent.environment_id ?? environmentId,
          name:               agent.name ?? agentId,
          slug:               slugify(agent.name ?? agentId),
          description:        agent.description ?? undefined,
          category:           agent.metadata?.category ?? undefined,
        });
        synced.push(agentId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${agentId}: ${msg}`);
      }
    }

    return NextResponse.json({
      message: `${synced.length} Agent(en) synchronisiert.`,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync-Agents Fehler:", error);
    const msg = error instanceof Error ? error.message : "API-Fehler";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
