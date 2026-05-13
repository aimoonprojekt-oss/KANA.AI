import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

/**
 * GET /api/admin/test-agent-api?masterId=agent_xxx
 *
 * Testet agents.retrieve() + agents.create() mit den korrekten Feldern.
 * Aus dem ersten Test wissen wir:
 *  - retrieve() funktioniert ✅
 *  - create() schlägt fehl wegen environment_id → jetzt entfernt
 *  - Korrekte Felder: name, model (Objekt), system, description, tools, skills, mcp_servers
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const masterId = req.nextUrl.searchParams.get("masterId");
  if (!masterId) return NextResponse.json({ error: "?masterId=agent_xxx fehlt" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  // ── 1. Master-Agent laden ────────────────────────────────────────────────
  let masterAgent: Record<string, unknown>;
  try {
    masterAgent = await beta.agents.retrieve(masterId);
  } catch (e) {
    return NextResponse.json({ error: `retrieve fehlgeschlagen: ${String(e)}` }, { status: 500 });
  }

  // ── 2. Kopie erstellen — ohne environment_id, mit korrekten Feldern ─────
  let createdAgent: Record<string, unknown> | null = null;
  let createError: string | null = null;
  try {
    createdAgent = await beta.agents.create({
      name:        `TEST_COPY_DELETE_ME_${Date.now()}`,
      model:       masterAgent.model,
      description: masterAgent.description ?? "",
      system:      masterAgent.system ?? "",
      tools:       masterAgent.tools ?? [],
      skills:      masterAgent.skills ?? [],
      mcp_servers: masterAgent.mcp_servers ?? [],
    });
  } catch (e) {
    createError = String(e);
  }

  // ── 3. Test-Kopie direkt wieder löschen ─────────────────────────────────
  let deleteResult: string | null = null;
  if (createdAgent?.id) {
    try {
      await beta.agents.delete(createdAgent.id);
      deleteResult = "gelöscht ✅";
    } catch (e) {
      deleteResult = `Löschen fehlgeschlagen: ${String(e)}`;
    }
  }

  const canCopy = !!createdAgent && !createError;

  return NextResponse.json({
    summary: canCopy
      ? "✅ Kundenkopien möglich — retrieve + create funktionieren"
      : "❌ create fehlgeschlagen — siehe createError",
    canCopy,
    newAgentId:  createdAgent?.id ?? null,
    deleteResult,
    createError,
    masterFields: {
      name:    masterAgent.name,
      model:   masterAgent.model,
      hasSystem: !!(masterAgent.system),
      toolCount: Array.isArray(masterAgent.tools) ? masterAgent.tools.length : 0,
    },
  });
}
