import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

/**
 * GET /api/admin/test-agent-api?masterId=agent_xxx
 *
 * Testet welche Anthropic Agent-API Calls verfügbar sind:
 * 1. agents.retrieve() → Master-Config lesen
 * 2. agents.create()   → Kundenkopie erstellen (entscheidend)
 * 3. agents.delete()   → Test-Kopie wieder löschen
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const masterId = req.nextUrl.searchParams.get("masterId");
  if (!masterId) return NextResponse.json({ error: "?masterId=agent_xxx fehlt" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  const results: Record<string, unknown> = {};

  // ── 1. agents.retrieve() ─────────────────────────────────────────────────
  try {
    const agent = await beta.agents.retrieve(masterId);
    results.retrieve = { ok: true, agent };
  } catch (e) {
    results.retrieve = { ok: false, error: String(e) };
  }

  // ── 2. agents.create() — nur wenn retrieve geklappt hat ──────────────────
  if ((results.retrieve as { ok: boolean }).ok) {
    const masterAgent = (results.retrieve as { agent: Record<string, unknown> }).agent;
    try {
      const copy = await beta.agents.create({
        name:           `TEST_COPY_DELETE_ME_${Date.now()}`,
        model:          masterAgent.model,
        description:    masterAgent.description ?? "Test-Kopie",
        instructions:   masterAgent.instructions ?? masterAgent.system_prompt,
        tools:          masterAgent.tools ?? [],
        environment_id: process.env.ANTHROPIC_ENVIRONMENT_ID,
      });
      results.create = { ok: true, newAgentId: copy.id, copy };

      // ── 3. Test-Kopie direkt wieder löschen ──────────────────────────────
      try {
        await beta.agents.delete(copy.id);
        results.delete = { ok: true };
      } catch (e) {
        results.delete = { ok: false, error: String(e) };
      }
    } catch (e) {
      results.create = { ok: false, error: String(e) };
    }
  } else {
    results.create = { ok: false, skipped: "retrieve fehlgeschlagen" };
  }

  const canCopy =
    (results.retrieve as { ok: boolean }).ok &&
    (results.create as { ok: boolean }).ok;

  return NextResponse.json({
    summary: canCopy
      ? "✅ Kundenkopien möglich — retrieve + create funktionieren"
      : "❌ Kundenkopien nicht möglich — siehe errors unten",
    canCopy,
    details: results,
  });
}
