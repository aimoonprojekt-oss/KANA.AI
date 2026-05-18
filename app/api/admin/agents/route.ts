import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAllAgents, getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.length === 0) return true;
  return adminIds.includes(userId);
}

/** GET /api/admin/agents — alle Agents aus Supabase */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  if (!isAdmin(userId)) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const agents = await getAllAgents();
  return NextResponse.json({ agents });
}

/**
 * PATCH /api/admin/agents
 * Body: { anthropic_agent_id: string; published?: boolean; featured?: boolean;
 *         price_eur?: number; stripe_price_id?: string; category?: string }
 *
 * Aktualisiert ein oder mehrere Felder eines Agents.
 * Felder die NICHT im Body stehen bleiben unverändert.
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  if (!isAdmin(userId)) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const body = await req.json();
  const { anthropic_agent_id, ...fields } = body;

  if (!anthropic_agent_id) {
    return NextResponse.json({ error: "anthropic_agent_id fehlt" }, { status: 400 });
  }

  // Nur erlaubte Felder zulassen
  const allowed = ["published", "featured", "price_eur", "stripe_price_id", "category"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Keine gültigen Felder zum Aktualisieren" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("agents")
    .update(update)
    .eq("anthropic_agent_id", anthropic_agent_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: update });
}
