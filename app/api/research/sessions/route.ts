import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin, isAdminUser } from '@/lib/platform/supabase'

export const runtime = 'nodejs'

export async function GET() {
  // K2: Diese Route war ueber middleware.ts als oeffentlich eingetragen und
  // gab interne Geschaeftsdaten ohne Login heraus. Auth gehoert zusaetzlich
  // in die Route selbst — eine Zeile in der Middleware ist zu leicht verloren.
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  if (!isAdminUser(userId)) return Response.json({ error: 'Kein Zugriff' }, { status: 403 })

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('research_sessions')
    .select('id, product, ad_format, ad_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data ?? []), { headers: { 'Content-Type': 'application/json' } })
}
