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

  // Admin-Prüfung: userId muss in ADMIN_USER_IDS stehen
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    return NextResponse.json({ message: "Kein Zugriff — nur Admins dürfen syncen." }, { status: 403 });
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

    // Zur Diagnose: rohe API-Antwort loggen
    console.log("Anthropic agents.list() Antwort:", JSON.stringify(agentsResponse, null, 2));

    // SDK kann `{ data: [...] }`, `{ agents: [...] }` oder direkt ein Array zurückgeben
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentList: any[] =
      agentsResponse?.data ??
      agentsResponse?.agents ??
      (Array.isArray(agentsResponse) ? agentsResponse : []);

    if (agentList.length === 0) {
      return NextResponse.json({
        message: "Keine Agents in der Anthropic Console gefunden.",
        raw: agentsResponse,   // hilft bei der Diagnose
        synced: [],
      });
    }

    const synced: { id: string; name: string }[] = [];
    const errors: string[] = [];

    for (const agent of agentList) {
      // Anthropic gibt IDs je nach SDK-Version als `id` oder `agent_id` zurück
      const agentId: string = agent.id ?? agent.agent_id ?? "";
      const agentName: string = agent.name ?? agent.display_name ?? agentId;

      if (!agentId) {
        errors.push(`Agent ohne ID übersprungen: ${JSON.stringify(agent)}`);
        continue;
      }

      // Kundenkopien überspringen — sie werden beim Kauf automatisch angelegt
      // und gehören NICHT in den Katalog. Erkennungsmuster: " — user_xxxxxxxxx"
      if (/ — user_\w+/.test(agentName)) {
        console.log(`↷ Kundenkopie übersprungen: ${agentName} (${agentId})`);
        continue;
      }

      try {
        await upsertAgent({
          anthropic_agent_id: agentId,
          environment_id:     agent.environment_id ?? agent.environmentId ?? environmentId,
          name:               agentName,
          slug:               slugify(agentName),
          description:        agent.description ?? undefined,
          category:           agent.metadata?.category ?? agent.category ?? undefined,
        });
        synced.push({ id: agentId, name: agentName });
        console.log(`✓ Agent gespeichert: ${agentName} (${agentId})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`✗ Agent-Fehler ${agentId}:`, msg);
        errors.push(`${agentName} (${agentId}): ${msg}`);
      }
    }

    return NextResponse.json({
      message: `${synced.length} von ${agentList.length} Agent(en) synchronisiert.`,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync-Agents Fehler:", error);
    const msg = error instanceof Error ? error.message : "API-Fehler";
    return NextResponse.json({ message: msg, detail: String(error) }, { status: 500 });
  }
}
