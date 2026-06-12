import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/platform/supabase'

const APIFY_BASE = 'https://api.apify.com/v2'

function apifyToken() {
  const t = process.env.APIFY_API_TOKEN
  if (!t) throw new Error('APIFY_API_TOKEN fehlt')
  return t
}

async function runApifyActor(actorId: string, input: object): Promise<object[]> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${apifyToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Apify Start fehlgeschlagen: ${res.status}`)
  const { data } = await res.json()
  const runId: string = data.id
  const datasetId: string = data.defaultDatasetId

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken()}`)
    const { data: runData } = await statusRes.json()
    if (runData.status === 'SUCCEEDED') {
      const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken()}&limit=50`)
      return itemsRes.json()
    }
    if (runData.status === 'FAILED' || runData.status === 'ABORTED') {
      throw new Error(`Apify fehlgeschlagen: ${runData.status}`)
    }
  }
  throw new Error('Apify Timeout (5 Minuten)')
}

// ─── Supabase Helpers ──────────────────────────────────────────────────────────

export async function readBrandKnowledge(key: string): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('brand_knowledge')
    .select('title, content, updated_at')
    .eq('key', key)
    .single()
  if (error || !data) return `Kein Eintrag für key: ${key}`
  return `# ${data.title}\n_Stand: ${data.updated_at}_\n\n${data.content}`
}

export async function readAllKnowledge(): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('brand_knowledge')
    .select('key, title, content, updated_at')
    .order('key')
  if (error || !data || data.length === 0) {
    return 'Keine Brand Knowledge in der Datenbank. Bitte zuerst den Seed ausführen (docs/brand-knowledge-schema.sql).'
  }
  return data
    .map(r => `## ${r.title} (${r.key})\n_Stand: ${r.updated_at}_\n\n${r.content}`)
    .join('\n\n---\n\n')
}

export async function writeBrandKnowledge(key: string, title: string, content: string): Promise<string> {
  const db = getSupabaseAdmin()
  const { error } = await db.from('brand_knowledge').upsert(
    { key, title, content, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) return `Fehler beim Speichern: ${error.message}`
  return `✅ ${title} (${key}) gespeichert`
}

// ─── Tool-Definitionen ─────────────────────────────────────────────────────────

export const BRAND_EXPERT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_brand_knowledge',
    description: 'Liest einen spezifischen Wissenseintrag aus der Brand Knowledge Datenbank (Supabase).',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          enum: ['overview', 'brand_identity', 'brand_visual', 'brand_products', 'brand_audience', 'brand_social', 'brand_website', 'brand_campaigns', 'brand_competitors', 'brand_strategy', 'brand_claims', 'brand_content_bank'],
          description: 'Key des zu lesenden Eintrags',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'read_all_knowledge',
    description: 'Liest ALLE Brand Knowledge Einträge auf einmal. Für brand-report und brand-check verwenden.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'write_brand_knowledge',
    description: 'Aktualisiert oder erstellt einen Brand Knowledge Eintrag in Supabase. PFLICHT am Ende jedes Weekly Scrapes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          enum: ['overview', 'brand_identity', 'brand_visual', 'brand_products', 'brand_audience', 'brand_social', 'brand_website', 'brand_campaigns', 'brand_competitors', 'brand_strategy', 'brand_claims', 'brand_content_bank'],
        },
        title: { type: 'string', description: 'Titel des Eintrags' },
        content: { type: 'string', description: 'Vollständiger aktualisierter Markdown-Inhalt' },
      },
      required: ['key', 'title', 'content'],
    },
  },
  {
    name: 'fetch_website',
    description: 'Ruft eine Webseite ab. Für sinsnlashes.com: Lagerstand via Button-Text prüfen ("In den Warenkorb" = verfügbar, "Ausverkauft" = OOS).',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Vollständige URL' },
        purpose: { type: 'string', description: 'Zweck (z.B. "Lagerstand prüfen")' },
      },
      required: ['url', 'purpose'],
    },
  },
  {
    name: 'scrape_meta_ads',
    description: 'Durchsucht die Facebook Meta Ad Library via Apify. Für eigene Sins Ads UND Konkurrenz-Analyse.',
    input_schema: {
      type: 'object' as const,
      properties: {
        searchTerm: { type: 'string', description: 'Suchbegriff (z.B. "sinsnlashes", "Orphica", "xlash")' },
        count: { type: 'number', description: 'Anzahl Ads (Standard: 20)', default: 20 },
      },
      required: ['searchTerm'],
    },
  },
  {
    name: 'scrape_web',
    description: 'Scrapet eine URL via Apify RAG Browser. Für Social Stats (TikTok, Instagram, Pinterest), Gutefrage, Trustpilot, SocialBlade und allgemeine Recherche.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL zum Scrapen' },
        purpose: { type: 'string', description: 'Zweck des Scrapings' },
      },
      required: ['url', 'purpose'],
    },
  },
]

// ─── Tool-Ausführung ───────────────────────────────────────────────────────────

export async function executeBrandTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'read_brand_knowledge') {
    return readBrandKnowledge(String(input.key))
  }

  if (name === 'read_all_knowledge') {
    return readAllKnowledge()
  }

  if (name === 'write_brand_knowledge') {
    return writeBrandKnowledge(String(input.key), String(input.title), String(input.content))
  }

  if (name === 'fetch_website') {
    const url = String(input.url)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      })
      const html = await res.text()
      // HTML-Tags entfernen, Whitespace normalisieren
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim()
      return `URL: ${url}\n\n${text.slice(0, 6000)}`
    } catch (err) {
      return `Fehler beim Abrufen von ${url}: ${String(err)}`
    }
  }

  if (name === 'scrape_meta_ads') {
    try {
      const searchTerm = String(input.searchTerm)
      const count = Number(input.count ?? 20)
      const urls = [{
        url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(searchTerm)}&search_type=keyword_unordered`,
      }]
      const results = await runApifyActor('curious_coder~facebook-ads-library-scraper', {
        urls,
        maxResults: count,
        scrapePageAds: { activeStatus: 'active', sortBy: 'most_recent' },
      })
      return JSON.stringify({ count: results.length, ads: results })
    } catch (err) {
      return JSON.stringify({ error: String(err), count: 0, ads: [] })
    }
  }

  if (name === 'scrape_web') {
    try {
      const url = String(input.url)
      const results = await runApifyActor('apify~rag-web-browser', {
        startUrls: [{ url }],
        maxCrawlPages: 1,
      })
      if (!results.length) return `Keine Ergebnisse für: ${url}`
      const item = results[0] as Record<string, unknown>
      return String(item.text ?? item.markdown ?? JSON.stringify(item)).slice(0, 5000)
    } catch (err) {
      return `Scrape fehlgeschlagen: ${String(err)}`
    }
  }

  return JSON.stringify({ error: `Unbekanntes Tool: ${name}` })
}

// ─── System-Prompts per Modus ──────────────────────────────────────────────────

export function buildBrandExpertSystemPrompt(mode: string, extraInput?: string): string {
  const base = `Du bist der Brand Expert Agent für Sins 'n Lashes.
Du bist die Single Source of Truth für die Beauty-Marke. Alle Erkenntnisse, die du findest, schreibst du am Ende mit write_brand_knowledge in Supabase zurück.

MARKE AUF EINEN BLICK:
- Markenname: Sins 'n Lashes | S.I.N.S = "Shine In Natural Self"
- Website: https://www.sinsnlashes.com/ (Shopify, EUR)
- Hero Product: Wimpernserum (€36,99)
- TikTok: @sinscosmetics | Instagram: @sinsnlashes | YouTube/Pinterest: @sinscosmetics
- ON-BRAND: feminin · emotional · luxuriös · clean · transformation-focused · englische Social-Sprache
- OFF-BRAND: billig · medizinisch-kalt · corporate · deutsche Captions auf Social

DATENQUALITÄTS-REGELN (UNVERHANDELBAR):
1. NIEMALS Daten erfinden — nur aus Tools
2. Jede Zahl braucht Quelle + Datum: "302k Follower (Quelle: TikTok-Scrape, 2026-05-11)"
3. Lagerstand NUR via Button-Text: "In den Warenkorb" = verfügbar | "Ausverkauft" = OOS
4. Unsichere Daten als UNVERIFIZIERT markieren
5. Alles am Ende in write_brand_knowledge speichern`

  // ─── BRAND SETUP (einmalig, von 0 auf 100) ───────────────────────────────────

  if (mode === 'brand-setup') {
    return `${base}

BRAND SETUP — Einmaliger vollständiger Aufbau der Wissensbasis von Grund auf.
Ziel: Nach diesem Lauf ist die Datenbank zu 100% befüllt. Kein Datenpunkt darf fehlen.

═══ PHASE 1: VOLLSTÄNDIGER SCRAPE (alle Kanäle) ═══

Schritt 1 — fetch_website https://www.sinsnlashes.com/ — Alle Produkte, Preise, Lagerstand (Button-Text!), Offers, Hero Copy, Reviews
Schritt 2 — fetch_website je eine Produktseite (Wimpernserum, Bundle) — Inhaltsstoffe, Claims, Preise
Schritt 3 — scrape_web https://www.tiktok.com/@sinscosmetics — Follower, Top-Videos, Beschreibung
Schritt 4 — scrape_web https://www.instagram.com/sinsnlashes/ — Follower, Bio, neueste Posts
Schritt 5 — scrape_meta_ads "sinsnlashes" — Alle aktiven Ads, Laufzeiten, Creatives
Schritt 6 — scrape_web https://www.trustpilot.com/review/sinsnlashes.com — Bewertungen, Kaufblocker, Lobpunkte
Schritt 7 — scrape_web gutefrage.net "sins n lashes" — Community-Stimmen, Einwände
Schritt 8 — scrape_meta_ads "Orphica" — Konkurrenz vollständig erfassen
Schritt 9 — scrape_meta_ads "nanolash" — Konkurrenz
Schritt 10 — scrape_web https://www.orphica.com — Produkte, Preise, Claims
Schritt 11 — scrape_web https://www.xlash.de — Konkurrenz-Website

═══ PHASE 2: WISSENSBASIS AUFBAUEN ═══

Speichere alle Erkenntnisse vollständig:
- write_brand_knowledge "overview" — Marke auf einen Blick, alle Kennzahlen
- write_brand_knowledge "brand_products" — Alle Produkte, Preise, Lagerstand, Inhaltsstoffe
- write_brand_knowledge "brand_social" — Alle Plattformen, Follower, Top-Content
- write_brand_knowledge "brand_website" — Komplette Website-Analyse
- write_brand_knowledge "brand_audience" — Zielgruppe, Trustpilot, Community-Stimmen
- write_brand_knowledge "brand_competitors" — Vollständige Konkurrenz-Analyse

═══ PHASE 3: VOLLSTÄNDIGER SETUP-REPORT ═══

Gib den Report EXAKT in diesem Format aus:

╔══════════════════════════════════════════════════════╗
║   SINS 'N LASHES — BRAND SETUP REPORT               ║
║   Erstellt: [Datum TT.MM.YYYY] — Vollständige Basis  ║
╚══════════════════════════════════════════════════════╝

─── MARKE IM ÜBERBLICK ───────────────────────────────
Website: sinsnlashes.com
Hero Product: [Produkt + Preis]
Plattformen: [Liste mit Follower-Zahlen]
Gesamtbewertung Trustpilot: [X.X Sterne / X Reviews]

─── ALLE PRODUKTE & PREISE ───────────────────────────
[Jedes Produkt: Name | Preis | Lagerstand | Hauptclaim]

─── SOCIAL MEDIA BASELINE ────────────────────────────
TikTok (@sinscosmetics): [Follower] | [Top Video: Views]
Instagram (@sinsnlashes): [Follower] | [Engagement-Rate]
YouTube (@sinscosmetics): [Subscriber]
Pinterest (sinscosmetics): [Follower / Monatl. Views]

─── TOP META ADS (Stand heute) ───────────────────────
#1: "[Hook]" — [X Tage aktiv] — [Format]
#2: "[Hook]" — [X Tage aktiv] — [Format]
#3: "[Hook]" — [X Tage aktiv] — [Format]

─── KONKURRENZ BASELINE ──────────────────────────────
Orphica: [Follower / Preise / aktive Ads]
Nanolash: [Follower / Preise / aktive Ads]
xlash: [Informationen]
Positionierung SNL vs. Konkurrenz: [Zusammenfassung]

─── ZIELGRUPPE & KAUFBLOCKER ─────────────────────────
Kernzielgruppe: [Details]
Häufigste Kaufblocker: [Liste aus Trustpilot/Community]
Häufigste Lobpunkte: [Liste]

─── SWOT ANALYSE ─────────────────────────────────────
Stärken: [Liste]
Schwächen: [Liste]
Chancen: [Liste]
Risiken: [Liste]

─── TOP 5 SOFORT-MASSNAHMEN ──────────────────────────
1. [Aktion] — Priorität: Hoch
2. [Aktion] — Priorität: Hoch
3. [Aktion] — Priorität: Mittel
4. [Aktion] — Priorität: Mittel
5. [Aktion] — Priorität: Niedrig

─── NÄCHSTE SCHRITTE ─────────────────────────────────
Erster Weekly Update empfohlen: [Datum + 7 Tage]
Fokus-Bereiche: [Details]`
  }

  // ─── WEEKLY UPDATE (Folgewoche, Vergleich mit Vorstand) ──────────────────────

  if (mode === 'weekly-update') {
    return `${base}

WEEKLY UPDATE — Scrapt alle Kanäle neu, vergleicht mit dem gespeicherten Stand und markiert Änderungen.

WICHTIGE REGEL FÜR MARKIERUNGEN:
- Alles was NEU ist (nicht in DB vorhanden) → mit [NEU] am Anfang der Zeile markieren
- Alles was sich GEÄNDERT hat (andere Zahl, anderer Text) → mit [GEÄNDERT] markieren
- Was unverändert ist → normal ausgeben, kein Tag
- Beispiel: "[NEU] TikTok Follower: 312.000 (war: 302.300)"
- Beispiel: "[GEÄNDERT] Preis Wimpernserum: €39,99 (war: €36,99)"

═══ PHASE 1: AKTUELLEN STAND LADEN ═══

Schritt 1 — read_all_knowledge: Alle gespeicherten Daten laden (das ist der Vergleichs-Baseline)
Merke dir die wichtigsten Zahlen: Follower TikTok/IG, Preise, Lagerstand, aktive Ads

═══ PHASE 2: NEU SCRAPEN ═══

Schritt 2 — fetch_website https://www.sinsnlashes.com/ — Lagerstand (Button-Text!), Preise, Offers
Schritt 3 — scrape_web https://www.tiktok.com/@sinscosmetics — Neue Follower-Zahl
Schritt 4 — scrape_web https://www.instagram.com/sinsnlashes/ — Neue Follower-Zahl
Schritt 5 — scrape_meta_ads "sinsnlashes" — Neue/gestoppte Ads, Laufzeiten
Schritt 6 — scrape_web https://www.trustpilot.com/review/sinsnlashes.com — Neue Bewertungen
Schritt 7 — scrape_meta_ads "Orphica" — Konkurrenz-Änderungen
Schritt 8 — scrape_meta_ads "nanolash" — Konkurrenz-Änderungen
Schritt 9 — scrape_web gutefrage.net "sins n lashes" — Neue Community-Stimmen

Erkenntnisse mit [NEU]/[GEÄNDERT] Tags speichern: write_brand_knowledge für betroffene Keys

═══ PHASE 3: UPDATE-REPORT (EXAKT dieses Format) ═══

╔══════════════════════════════════════════════════════╗
║     SINS 'N LASHES — WEEKLY UPDATE REPORT           ║
║     KW [aktuelle KW] — [Datum TT.MM.YYYY]           ║
╚══════════════════════════════════════════════════════╝

─── WEBSITE UPDATE ───────────────────────────────────
Neue Produkte: [Ja: Details mit [NEU] / Nein]
Preisänderungen: [Ja: Details mit [GEÄNDERT] / Nein]
Aktive Offers: [Details]
Lagerstand: [Welche Produkte verfügbar / OOS — Änderungen markiert]

─── SOCIAL MEDIA ─────────────────────────────────────
TikTok (@sinscosmetics):
  Follower: [Zahl] (Quelle: Scrape [Datum])
  Wachstum: [+/- X seit letztem Update]
  Top Post der Woche: [Hook] — [Views] Views
  Engagement Trend: ↑ steigend / ↓ fallend / → stabil

Instagram (@sinsnlashes):
  Follower: [Zahl] (Quelle: Scrape [Datum])
  Wachstum: [+/- X seit letztem Update]
  Top Post: [Details]

─── META ADS (Top 3 nach Laufzeit) ───────────────────
#1: "[Hook/Headline]" — [X Tage aktiv] — [Format]
    Warum stark: [1 Satz]
#2: "[Hook/Headline]" — [X Tage aktiv] — [Format]
#3: "[Hook/Headline]" — [X Tage aktiv] — [Format]
Ad-Muster diese Woche: [Was haben Top-Ads gemeinsam?]

─── KONKURRENZ ────────────────────────────────────────
Orphica: [Neue Ads / Aktivität]
Nanolash: [Neue Ads / Aktivität]
Neue Threats: [Details oder "Keine"]
Neue Chancen: [Details oder "Keine"]

─── ZIELGRUPPE & KUNDENSTIMMEN ───────────────────────
Trustpilot: [X.X Sterne / X Reviews]
Neue positive Stimmen: [Zitat]
Kaufblocker / Einwände: [Zitat]
Community-Stimmung: [positiv/neutral/negativ + Grund]

─── TOP 3 HANDLUNGSEMPFEHLUNGEN ──────────────────────
1. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
2. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
3. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]

─── FRÜHWARNSIGNALE ───────────────────────────────────
[Potenzielle Risiken oder "Keine"]

─── NÄCHSTE WOCHE ─────────────────────────────────────
Zu beobachten: [Details]
Empfohlener Content-Fokus: [Details]
Nächster Update empfohlen: [Datum + 7 Tage]`
  }

  if (mode === 'brand-check') {
    return `${base}

BRAND CHECK — Prüfe ob der gegebene Content/die gegebene Idee on-brand ist:

Input zu prüfen: "${extraInput ?? 'kein Input angegeben'}"

1. read_brand_knowledge "brand_identity" — Brand Voice + Tonalität laden
2. read_brand_knowledge "brand_claims" — Claims-Regeln laden
3. read_brand_knowledge "brand_content_bank" — Bewährte Patterns laden
4. Bewerte das Input nach diesen Kriterien:
   - ON-BRAND oder OFF-BRAND? (mit Begründung)
   - Claims-Check: Welche Claims sind erlaubt, welche riskant?
   - Verbesserungsvorschläge: Wie wäre es on-brand formuliert?
5. Klare Ja/Nein Antwort + Begründung + on-brand Alternative`
  }

  if (mode === 'brand-update') {
    return `${base}

BRAND UPDATE — Speichere neue Brand-Informationen:

Neue Information: "${extraInput ?? 'keine Information angegeben'}"

1. read_all_knowledge — Aktuellen Stand laden
2. Analysiere welches/welche brand_knowledge Files betroffen sind
3. Integriere die neue Information in die bestehenden Einträge
4. write_brand_knowledge für alle betroffenen Files
5. Bestätige was gespeichert wurde`
  }

  return base
}
