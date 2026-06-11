const GEMINI_MODEL = 'gemini-2.5-flash'

function apiKey() {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('GEMINI_API_KEY fehlt in den Environment Variables')
  return k
}

const VIDEO_PROMPT = `Analysiere dieses Werbevideo und erstelle einen strukturierten Markdown-Report.

WICHTIGE REGELN:
- Berichte NUR was tatsächlich im Video sichtbar oder hörbar ist
- Erfinde KEINE Namen, Voiceovers oder Inhalte
- Wenn etwas unklar ist: "(nicht eindeutig erkennbar)" schreiben — niemals raten

## Top-Level Summary
2-3 Sätze was im Video passiert.

## Scene-by-Scene Breakdown
Für jede Szene mit MM:SS Timestamp:
- Sichtbarer Inhalt (UI, Text, Produkte, Personen)
- On-Screen-Text (verbatim)
- Kamera: Close-Up / Medium Shot / Wide Shot / Selfie/Handheld / Top-Down
- Licht: Natural Light / Ring Light / Studio / Backlit / Indoor Ambient / Unknown

## Audio
Nur was tatsächlich zu hören ist. Vollständiges Transkript oder "Kein Audio erkannt".

## Key Moments
3-7 wichtige Momente mit Timestamp und Beschreibung.

## Ad Format Klassifizierung
- Format: F1 UGC / F2 Talking Head / F3 Before-After / F4 Testimonial-Collage / F5 Produkt-Demo / F6 Text-Slideshow / F7 Influencer / F8 Statisches Bild
- Produktionsqualität: Niedrig / Mittel / Hoch
- Setting: Indoor / Outdoor / Studio / Mixed
- Seitenverhältnis: 9:16 / 16:9 / 1:1`

/** Analysiert ein Video via Gemini anhand einer öffentlichen URL */
export async function analyzeVideoUrl(videoUrl: string): Promise<string> {
  const key = apiKey()

  const body = {
    contents: [
      {
        parts: [
          { text: VIDEO_PROMPT },
          { file_data: { mime_type: 'video/mp4', file_uri: videoUrl } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API Fehler (${res.status}): ${err}`)
  }

  const json = await res.json()
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Kein Output von Gemini erhalten'
}
