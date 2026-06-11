import { getSupabaseAdmin } from '@/lib/supabase'
import { analyzeVideoUrl } from '@/lib/gemini'

// Läuft nur die Gemini-Analyse für bereits gespeicherte Ads nochmal
export async function POST(req: Request) {
  const { adId } = await req.json()

  if (!adId) {
    return Response.json({ error: 'adId fehlt' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Ad aus Supabase laden
  const { data: ad, error } = await db
    .from('ad_research')
    .select('ad_id, video_url')
    .eq('ad_id', String(adId))
    .maybeSingle()

  if (error || !ad) {
    return Response.json({ error: 'Ad nicht gefunden' }, { status: 404 })
  }

  // Supabase Storage URL zusammenbauen (falls video_url noch die Facebook URL ist)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/ad-videos/${ad.ad_id}.mp4`

  let breakdown: string
  try {
    breakdown = await analyzeVideoUrl(storageUrl)
  } catch (err) {
    return Response.json({ error: `Gemini Analyse fehlgeschlagen: ${String(err)}` }, { status: 500 })
  }

  // Breakdown in Supabase speichern
  const { error: updateError } = await db
    .from('ad_research')
    .update({
      video_breakdown:  breakdown,
      status:           'breakdown_complete',
      datenstatus:      'vollständig',
      breakdown_datum:  new Date().toISOString(),
      video_analyzer:   'gemini-2.5-flash',
    })
    .eq('ad_id', String(adId))

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ success: true, adId, breakdownLength: breakdown.length })
}
