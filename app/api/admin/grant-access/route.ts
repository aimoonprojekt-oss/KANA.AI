import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { grantAgentAccess, getDBAgentById } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/admin/grant-access
 * Body: { anthropicAgentId: string }
 *
 * Schaltet den eingeloggten User für einen Agent frei.
 * Legt automatisch eine Organisation an falls noch keine existiert.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  const { anthropicAgentId } = await req.json();
  if (!anthropicAgentId) {
    return NextResponse.json({ message: "anthropicAgentId fehlt" }, { status: 400 });
  }

  const agent = await getDBAgentById(anthropicAgentId);
  if (!agent) {
    return NextResponse.json({ message: "Agent nicht gefunden" }, { status: 404 });
  }

  try {
    await grantAgentAccess(userId, anthropicAgentId);
    return NextResponse.json({
      message: `Zugang zu "${agent.name}" erfolgreich freigeschaltet.`,
      agent:   { id: agent.id, name: agent.name },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
