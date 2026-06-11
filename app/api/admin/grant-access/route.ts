import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { grantAgentAccess, getDBAgentById } from "@/lib/platform/supabase";

export const runtime = "nodejs";

/**
 * Gibt true zurück wenn userId in der ADMIN_USER_IDS Umgebungsvariable steht.
 * ADMIN_USER_IDS = komma-getrennte Clerk user_ids, z.B.:
 *   user_2abc123,user_2xyz456
 * In Vercel unter Settings → Environment Variables setzen.
 */
function isAdmin(userId: string): boolean {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  if (!raw.trim()) return false;
  return raw.split(",").map((id) => id.trim()).includes(userId);
}

/**
 * POST /api/admin/grant-access
 * Body: { anthropicAgentId: string, targetUserId?: string }
 *
 * Schaltet einen User für einen Agent frei (ohne Zahlung, nur für Admins).
 * targetUserId: optional — wenn gesetzt, wird dieser User freigeschaltet statt
 * des eingeloggten Admins. Falls nicht gesetzt, wird der Admin selbst freigeschaltet.
 *
 * Voraussetzung: ADMIN_USER_IDS Env-Variable muss die Clerk user_id des Admins enthalten.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  // ── Admin-Prüfung ────────────────────────────────────────────────────────────
  if (!isAdmin(userId)) {
    return NextResponse.json(
      { message: "Kein Zugriff — nur Admins dürfen diesen Endpoint nutzen." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { anthropicAgentId, targetUserId } = body;

  if (!anthropicAgentId) {
    return NextResponse.json({ message: "anthropicAgentId fehlt" }, { status: 400 });
  }

  // Welcher User soll freigeschaltet werden?
  // targetUserId erlaubt dem Admin, einen anderen User freizuschalten.
  const recipientUserId: string = targetUserId ?? userId;

  const agent = await getDBAgentById(anthropicAgentId);
  if (!agent) {
    return NextResponse.json({ message: "Agent nicht gefunden" }, { status: 404 });
  }

  try {
    await grantAgentAccess(recipientUserId, anthropicAgentId);
    return NextResponse.json({
      message: `Zugang zu "${agent.name}" für User ${recipientUserId} freigeschaltet.`,
      agent:   { id: agent.id, name: agent.name },
      grantedTo: recipientUserId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
