import { getSupabaseAdmin } from '@/lib/platform/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('research_sessions')
    .select('id, product, ad_format, ad_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data ?? []), { headers: { 'Content-Type': 'application/json' } })
}
