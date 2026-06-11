import { getSupabaseAdmin } from '@/lib/platform/supabase'

const BUCKET = 'ad-videos'
const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

/**
 * Lädt ein Video von einer URL herunter und speichert es in Supabase Storage.
 * Gibt die öffentliche URL zurück, die Gemini direkt abrufen kann.
 */
export async function downloadAndStoreVideo(videoUrl: string, adId: string): Promise<string> {
  // Video herunterladen
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KANA-Research-Bot/1.0)',
    },
    signal: AbortSignal.timeout(60_000), // 60 Sekunden Timeout
  })

  if (!response.ok) {
    throw new Error(`Video-Download fehlgeschlagen (${response.status}): ${videoUrl}`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
    throw new Error(`Video zu groß (${Math.round(parseInt(contentLength) / 1024 / 1024)} MB, max 100 MB)`)
  }

  const buffer = await response.arrayBuffer()

  if (buffer.byteLength > MAX_SIZE_BYTES) {
    throw new Error(`Video zu groß (${Math.round(buffer.byteLength / 1024 / 1024)} MB, max 100 MB)`)
  }

  // Content-Type bestimmen
  const contentType = response.headers.get('content-type') || 'video/mp4'
  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  const path = `${adId}.${ext}`

  // In Supabase Storage hochladen
  const db = getSupabaseAdmin()
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`Supabase Storage Upload fehlgeschlagen: ${error.message}`)

  // Öffentliche URL zurückgeben
  const { data } = db.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
