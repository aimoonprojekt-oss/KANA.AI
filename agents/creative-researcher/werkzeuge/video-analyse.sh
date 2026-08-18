#!/usr/bin/env bash
# Video-Breakdown ueber Gemini.
# Entspricht lib/agents/gemini.ts. VIDEO_PROMPT ist wortgleich uebernommen,
# ebenso Modell, temperature 0.1 und maxOutputTokens 4096.
#
# Unterschied zum Altpfad: Statt das Video oeffentlich in Supabase Storage zu
# legen und Gemini die URL zu geben, wird es ueber die Gemini-Files-API
# hochgeladen. Im Container gibt es kein oeffentliches Zwischenlager — und es
# wird auch keines gebraucht. Siehe claude/15_Vorlage_Creative-Researcher.md,
# Abweichung 2.
#
# Aufruf: video-analyse.sh <video.mp4> <ausgabe.md>
set -euo pipefail

VIDEO="$1"; OUT="$2"
MODELL="gemini-2.5-flash"
API="https://generativelanguage.googleapis.com"
TYP="video/mp4"
GROESSE=$(stat -c%s "$VIDEO")

# Gemini-Schluessel nur im Header (x-goog-api-key), NIE als ?key=... —
# Vault-Werte werden ausschliesslich in Header eingesetzt.

# 1) Datei zu Gemini hochladen (resumable upload)
UPLOAD=$(curl -s -D - -o /dev/null -X POST "${API}/upload/v1beta/files" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${GROESSE}" \
  -H "X-Goog-Upload-Header-Content-Type: ${TYP}" \
  -H "Content-Type: application/json" \
  -d '{"file":{"display_name":"ad"}}' \
  | tr -d '\r' | awk 'tolower($1)=="x-goog-upload-url:"{print $2}')

DATEI=$(curl -s -X POST "$UPLOAD" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Length: ${GROESSE}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${VIDEO}")

URI=$(echo "$DATEI"  | jq -r '.file.uri')
NAME=$(echo "$DATEI" | jq -r '.file.name')

# 2) Warten, bis Gemini das Video verarbeitet hat
ZUSTAND=""
for _ in $(seq 1 60); do
  ZUSTAND=$(curl -s "${API}/v1beta/${NAME}" -H "x-goog-api-key: $GEMINI_API_KEY" | jq -r '.state')
  [ "$ZUSTAND" = "ACTIVE" ] && break
  [ "$ZUSTAND" = "FAILED" ] && { echo "Gemini konnte das Video nicht verarbeiten" >&2; exit 1; }
  sleep 5
done
[ "$ZUSTAND" = "ACTIVE" ] || { echo "Gemini Timeout bei der Videoverarbeitung" >&2; exit 1; }

PROMPT='Analysiere dieses Werbevideo und erstelle einen strukturierten Markdown-Report.

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
- Seitenverhältnis: 9:16 / 16:9 / 1:1'

# 3) Analyse anfordern
mkdir -p "$(dirname "$OUT")"
curl -s -X POST "${API}/v1beta/models/${MODELL}:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" --arg u "$URI" --arg t "$TYP" '{
        contents: [{ parts: [ {text:$p}, {file_data:{mime_type:$t, file_uri:$u}} ] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      }')" \
  | jq -r '.candidates[0].content.parts[0].text // "Kein Output von Gemini erhalten"' > "$OUT"

echo "Breakdown: $OUT ($(wc -c < "$OUT") Zeichen)"
