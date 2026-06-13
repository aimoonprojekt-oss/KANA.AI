import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/platform/supabase'
import { searchFacebookAds } from '@/lib/agents/apify'
import { analyzeVideoUrl } from '@/lib/agents/gemini'
import { downloadAndStoreVideo } from '@/lib/agents/videoStorage'

export const runtime = 'nodejs'
export const maxDuration = 600

const SNL_KEYWORDS = ['sinsnlashes', 'sins n lashes', 'sins & lashes', 'sinsnlashes.com']
const RETAILER_KEYWORDS = ['rossmann', 'müller', 'douglas', 'dm ', 'drogerie', 'amazon', 'otto']

// ─── Tool-Definitionen für Claude ─────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_facebook_ads',
    description: 'Durchsucht die Facebook Ad Library via Apify und gibt gefilterte, gerankte Ads zurück.',
    input_schema: {
      type: 'object' as const,
      properties: {
        searchTerms: { type: 'array', items: { type: 'string' }, description: 'Suchbegriffe' },
        adType:      { type: 'string', enum: ['VIDEO', 'IMAGE'], description: 'Ad-Format' },
        adCount:     { type: 'number', description: 'Gewünschte Anzahl Ads' },
      },
      required: ['searchTerms', 'adType', 'adCount'],
    },
  },
  {
    name: 'download_video',
    description: 'Lädt ein Video von einer Facebook/CDN URL herunter und speichert es in Supabase Storage. Gibt eine stabile öffentliche URL zurück die Gemini verwenden kann.',
    input_schema: {
      type: 'object' as const,
      properties: {
        videoUrl: { type: 'string', description: 'Facebook CDN URL zum Video' },
        adId:     { type: 'string', description: 'Ad-ID für den Dateinamen' },
      },
      required: ['videoUrl', 'adId'],
    },
  },
  {
    name: 'analyze_video',
    description: 'Analysiert ein Video via Gemini AI und erstellt einen detaillierten Breakdown. Nur mit stabilen Supabase Storage URLs verwenden (nicht mit Facebook URLs).',
    input_schema: {
      type: 'object' as const,
      properties: {
        videoUrl: { type: 'string', description: 'Stabile Supabase Storage URL zum Video (von download_video)' },
        adId:     { type: 'string', description: 'Ad-ID für die Zuordnung' },
      },
      required: ['videoUrl', 'adId'],
    },
  },
  {
    name: 'save_ad_research',
    description: 'Speichert den Research-Report einer Ad in Supabase.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adId:            { type: 'string' },
        advertiser:      { type: 'string' },
        targetProduct:   { type: 'string' },
        adFormat:        { type: 'string' },
        startDate:       { type: 'string' },
        laufzeitTage:    { type: 'number' },
        impressionen:    { type: 'string' },
        varianten:       { type: 'number' },
        plattformen:     { type: 'string' },
        adText:          { type: 'string' },
        headline:        { type: 'string' },
        ctaButton:       { type: 'string' },
        landingPage:     { type: 'string' },
        videoUrl:        { type: 'string' },
        thumbnailUrl:    { type: 'string' },
        videoBreakdown:  { type: 'string' },
        rohdaten:        { type: 'object' },
        datenstatus:     { type: 'string' },
      },
      required: ['adId', 'advertiser', 'targetProduct', 'adFormat'],
    },
  },
]

// ─── Tool-Ausführung ──────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>, targetProduct: string, minImpressions = 0): Promise<string> {
  if (name === 'search_facebook_ads') {
    const { searchTerms, adType, adCount } = input as { searchTerms: string[], adType: string, adCount: number }

    // Bereits verarbeitete Ad-IDs holen
    const db = getSupabaseAdmin()
    const { data: existing } = await db.from('ad_research').select('ad_id')
    const existingIds = new Set((existing ?? []).map(r => r.ad_id))

    let results = await searchFacebookAds({ searchTerms, adType, country: 'DE', maxResults: 30 })

    // Zweiter Call falls zu wenig Ergebnisse
    if (results.length < (adCount as number)) {
      const broader = await searchFacebookAds({
        searchTerms: ['lash', 'wimpern', 'eye serum', 'eyelash'],
        adType, country: 'DE', maxResults: 30,
      })
      const seen = new Set((results as Record<string, unknown>[]).map(a => a.ad_archive_id))
      for (const ad of broader as Record<string, unknown>[]) {
        if (!seen.has(ad.ad_archive_id)) results.push(ad)
      }
    }

    // Filter
    const filtered = (results as Record<string, unknown>[]).filter(ad => {
      if (!ad.ad_archive_id) return false
      if (existingIds.has(String(ad.ad_archive_id))) return false
      const text = `${ad.page_name ?? ''} ${ad.link_url ?? ''} ${ad.ad_creative_body ?? ''}`.toLowerCase()
      if (SNL_KEYWORDS.some(k => text.includes(k))) return false
      if (RETAILER_KEYWORDS.some(k => text.includes(k))) return false
      const imp = parseInt(String(ad.impressions_text ?? '0')) || 0
      if (minImpressions > 0 && imp > 0 && imp < minImpressions) return false
      // Bei VIDEO-Suche: nur Ads mit tatsächlicher video_url behalten
      if (adType === 'VIDEO' && !ad.video_hd_url && !ad.video_sd_url && !ad.video_preview_image_url) return false
      return true
    })

    // Ranking: Laufzeit × 10 + Impressionen × 0.0001 + Varianten × 5
    const ranked = filtered.sort((a, b) => {
      const score = (ad: Record<string, unknown>) => {
        const days = ad.start_date
          ? Math.floor((Date.now() - new Date(String(ad.start_date)).getTime()) / 86400000)
          : 0
        const imp = parseInt(String(ad.impressions_text ?? '0')) || 0
        const variants = parseInt(String(ad.ad_count ?? '1')) || 1
        return days * 10 + imp * 0.0001 + variants * 5
      }
      return score(b as Record<string, unknown>) - score(a as Record<string, unknown>)
    })

    const selected = ranked.slice(0, adCount as number)
    return JSON.stringify({ count: selected.length, ads: selected })
  }

  if (name === 'download_video') {
    const { videoUrl, adId } = input as { videoUrl: string, adId: string }
    try {
      const storageUrl = await downloadAndStoreVideo(videoUrl, adId)
      return JSON.stringify({ adId, storageUrl, success: true })
    } catch (err) {
      return JSON.stringify({ adId, success: false, error: String(err) })
    }
  }

  if (name === 'analyze_video') {
    const { videoUrl, adId } = input as { videoUrl: string, adId: string }
    try {
      const breakdown = await analyzeVideoUrl(videoUrl)
      return JSON.stringify({ adId, breakdown })
    } catch (err) {
      return JSON.stringify({ adId, error: String(err), breakdown: `Analyse fehlgeschlagen: ${String(err)}` })
    }
  }

  if (name === 'save_ad_research') {
    const db = getSupabaseAdmin()
    const { error } = await db.from('ad_research').upsert({
      ad_id:             String(input.adId),
      advertiser:        String(input.advertiser ?? 'nicht verfügbar (API)'),
      target_product:    targetProduct,
      ad_format:         String(input.adFormat ?? 'nicht verfügbar'),
      start_date:        String(input.startDate ?? 'nicht verfügbar (API)'),
      laufzeit_tage:     Number(input.laufzeitTage ?? 0),
      impressionen:      String(input.impressionen ?? 'nicht verfügbar (API)'),
      varianten:         Number(input.varianten ?? 1),
      plattformen:       String(input.plattformen ?? 'nicht verfügbar (API)'),
      ad_text:           String(input.adText ?? 'nicht verfügbar (API)'),
      headline:          String(input.headline ?? 'nicht verfügbar (API)'),
      cta_button:        String(input.ctaButton ?? 'nicht verfügbar (API)'),
      landing_page:      String(input.landingPage ?? 'nicht verfügbar (API)'),
      video_url:         String(input.videoUrl ?? 'nicht verfügbar'),
      thumbnail_url:     String(input.thumbnailUrl ?? 'nicht verfügbar (API)'),
      video_breakdown:   String(input.videoBreakdown ?? ''),
      rohdaten:          input.rohdaten ?? {},
      status:            input.videoBreakdown ? 'breakdown_complete' : 'research_complete',
      datenstatus:       String(input.datenstatus ?? 'nur Library-Daten'),
      bereit_fuer_analyst: true,
      research_datum:    new Date().toISOString(),
    }, { onConflict: 'ad_id' })

    if (error) return JSON.stringify({ success: false, error: error.message })
    return JSON.stringify({ success: true, adId: input.adId })
  }

  return JSON.stringify({ error: `Unbekanntes Tool: ${name}` })
}

// ─── System-Prompt für Claude ─────────────────────────────────────────────────

function buildSystemPrompt(targetProduct: string, adCount: number, adType: string): string {
  return `Du bist der Creative Research Agent für Sins n Lashes (SNL).

Deine Aufgabe: Competitor-Ads für "${targetProduct}" finden, filtern, ranken und in Supabase speichern.
Gewünschte Anzahl: ${adCount} Ads. Format: ${adType}.

ABSOLUTES AUSSCHLUSS-PRINZIP: Ads von Sins n Lashes (sinsnlashes.com, @sinsnlashes) niemals aufnehmen.

ABLAUF — führe diese Schritte der Reihe nach aus:

1. Rufe "search_facebook_ads" auf mit den passenden Keywords für "${targetProduct}".
   Keywords für Wimpernserum: ["lash serum", "wimpernserum", "eyelash growth serum", "lash growth"]
   Keywords für Augenbrauenserum: ["brow serum", "eyebrow serum", "augenbrauenserum"]
   Keywords für Haarserum/Haaröl: ["hair serum", "haarserum", "rosemary hair serum"]
   Keywords für Rosmarinöl: ["rosemary oil hair", "rosmarinöl haare"]
   Keywords für Mascara: ["growth mascara", "lash mascara serum"]
   Keywords für Wimpernlifting: ["lash lift kit", "wimpernlifting"]

2. Für jede Ad die ein video_url Feld in den API-Daten hat:
   a) Rufe zuerst "download_video" auf mit der Facebook CDN URL und der Ad-ID.
      Das Video wird heruntergeladen und in Supabase Storage gespeichert.
   b) Wenn download_video erfolgreich war (success: true), rufe "analyze_video" auf
      mit der zurückgegebenen storageUrl (NICHT die originale Facebook URL).
   c) Wenn download_video fehlschlägt: Ad trotzdem speichern, aber ohne Video-Breakdown.

3. Rufe für jede Ad "save_ad_research" auf mit ALLEN verfügbaren Daten aus den API-Responses.
   - Laufzeit berechnen: aktuelles Datum minus start_date in Tagen
   - Fehlende Felder als "nicht verfügbar (API)" eintragen — niemals raten
   - datenstatus: "vollständig" wenn Video-Breakdown vorhanden, sonst "nur Library-Daten"

4. Gib am Ende eine Zusammenfassung aus: wie viele Ads gefunden, wie viele gespeichert, wie viele mit Video-Breakdown.

QUALITÄTSREGELN:
- Niemals Daten erfinden oder raten
- Jeden Schritt klar ankündigen
- Fehler transparent melden aber trotzdem weitermachen`
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { targetProduct, adCount, adType, searchKeywords, minImpressions = 0 } = await req.json()

  if (!targetProduct || !adCount || !adType) {
    return new Response(JSON.stringify({ error: 'targetProduct, adCount und adType sind Pflichtfelder' }), { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // SSE Stream aufbauen — damit das Frontend live Updates sieht
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'start', message: `Creative Research startet für: ${targetProduct}` })

        const messages: Anthropic.MessageParam[] = [
          {
            role: 'user',
            content: `Starte die Creative Research für "${targetProduct}". Anzahl: ${adCount}. Format: ${adType}.${searchKeywords ? ` Keywords: ${searchKeywords.join(', ')}` : ''}`,
          },
        ]

        // Agentic Loop — Claude arbeitet bis er fertig ist
        while (true) {
          const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 8096,
            system:     buildSystemPrompt(targetProduct, adCount, adType),
            tools:      TOOLS,
            messages,
          })

          // Text-Output von Claude live senden
          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              send({ type: 'progress', message: block.text })
            }
          }

          // Fertig wenn kein Tool-Call mehr
          if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
            send({ type: 'done', message: 'Research abgeschlossen.' })
            break
          }

          // Tool-Calls ausführen
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool', message: `🔧 ${block.name}...` })
              try {
                const result = await executeTool(block.name, block.input as Record<string, unknown>, targetProduct, minImpressions)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
                send({ type: 'tool_done', message: `✅ ${block.name} fertig` })
              } catch (err) {
                const errMsg = String(err)
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Fehler: ${errMsg}`, is_error: true })
                send({ type: 'tool_error', message: `❌ ${block.name}: ${errMsg}` })
              }
            }
          }

          if (toolResults.length === 0) break

          // Nachrichten für nächste Runde updaten
          messages.push({ role: 'assistant', content: response.content })
          messages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        send({ type: 'error', message: `Fehler: ${String(err)}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
