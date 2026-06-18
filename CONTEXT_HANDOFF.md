# KANA.AI — Vollständiger Kontext-Handoff
> Für neues Chat-Fenster. Enthält alles was aus den vorherigen Sessions bekannt ist.
> Stand: 2026-06-18

---

## 0. SESSION 2026-06-18 — Alle Änderungen dieser Session

### Neue Features

#### Produkt-Relevanz-Filter (Researcher)
**Datei:** `app/api/research/run/route.ts`
- Funktion `getProductRelevanceKeywords(product)` — gibt produktspezifische Must-Have-Keywords zurück
- Für Wimpernserum: `['lash', 'serum', 'wimper', 'eyelash', 'wimpern', 'wachstum', 'growth']`
- Verhindert dass z.B. Wimpernzangen-Ads bei Wimpernserum-Suche auftauchen
- Filter scannt `JSON.stringify(ad)` — mindestens 1 Keyword muss vorkommen

#### Produktspezifischer Fallback-Call (Researcher)
**Datei:** `app/api/research/run/route.ts`
- Funktion `getFallbackSearchTerms(product)` — produktspezifische Fallback-Keywords
- Zweiter Apify-Call läuft jetzt nur noch wenn **exakt 0** Ergebnisse kommen (nicht schon bei "zu wenig")

#### Video-Dauer-Filter (Researcher)
**Datei:** `app/api/research/run/route.ts`, `app/components/agents/ResearchAgent.tsx`
- Min. 5 Sekunden: immer aktiv, hardcoded
- Max. Videolänge: Dropdown in UI (20s / 30s / 45s / 60s / 90s)
- **+3 Sekunden Toleranz:** Wenn zu wenig Ads gefunden → Grenze wird einmalig um 3s erhöht (30s → 33s)
- Dauer-Filter greift nur wenn Apify das Feld liefert (`video_duration`, `duration`, `video_length`, `videoDuration`)

#### Zeitraum-Filter / Date Range Picker (Researcher)
**Datei:** `app/api/research/run/route.ts`, `lib/agents/apify.ts`, `app/components/agents/ResearchAgent.tsx`
- Neuer Button "📅 Zeitraum" in der Researcher-UI
- Von/Bis Datumseingabe + Schnellauswahl (Black Friday 2024, Q4 2024, Q1 2025, Letzter Monat)
- Mit Datumsfilter: `active_status=all` + `start_date[min]/[max]` in der Apify-URL
- Ohne Datumsfilter: `active_status=active` (nur aktive Ads, wie bisher)

#### Research Sessions (Researcher + Analyst)
**Neue Supabase-Tabellen (SQL bereits ausgeführt):**
```sql
ALTER TABLE ad_research ADD COLUMN IF NOT EXISTS session_id TEXT;
CREATE TABLE IF NOT EXISTS research_sessions (
  id TEXT PRIMARY KEY, product TEXT, ad_format TEXT, ad_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ
);
```
**Neue API:** `app/api/research/sessions/route.ts` — GET, gibt alle Sessions zurück

**Researcher** (`app/api/research/run/route.ts`):
- Generiert beim Start eine `session_id` = `${Date.now()}-${random}`
- Speichert Session in `research_sessions` (id, product, ad_format, ad_count=0)
- Schreibt `session_id` zu jeder Ad in `ad_research`
- Erhöht `ad_count` in `research_sessions` nach jeder gespeicherten Ad

**Analyst UI** (`app/components/agents/CreativeAnalyst.tsx`):
- Lädt beim Öffnen alle Sessions via `/api/research/sessions`
- Zeigt Sessions als anklickbare Karten: Produkt · Datum · Uhrzeit · Format · Anzahl Ads
- Mehrfachauswahl möglich (Checkboxen)
- Keine Session ausgewählt → alle unanalysierten Ads (wie vorher)
- Ausgewählte Sessions → nur Ads dieser Sessions werden analysiert

**Analyst API** (`app/api/creative-analyst/run/route.ts`):
- Empfängt `sessionIds[]` aus Request Body
- Übergibt sie an `read_breakdowns` Tool

**Analyst-Lib** (`lib/agents/creativeAnalyst.ts`):
- `readBreakdowns(sessionIds?)` — filtert `ad_research` per `.in('session_id', sessionIds)` wenn angegeben

### Bugfixes dieser Session

#### Fix: Apify `count` statt `maxResults`
**Datei:** `lib/agents/apify.ts`
**Problem:** Parameter hieß `maxResults` aber der Actor erwartet `count` → Actor ignorierte die Grenze → scrafte tausende Ergebnisse (3.500–7.900) statt 30 → Laufzeit 7-18 Minuten
**Fix:** `maxResults` → `count` im Actor-Input
**Commits:** `a09f9fc`

#### Fix: Apify Polling — async statt waitForFinish
**Datei:** `lib/agents/apify.ts`
**Problem:** `waitForFinish=200` + Fallback-Polling 18×5s = 290s → Timeout bei großen Jobs
**Fix:** Actor wird async gestartet (kein waitForFinish), dann Polling alle 10s, max. 55×10s = 550s
- Jeder Poll hat 15s Timeout per `AbortController`
- Bei Netzwerkfehler während Polling: weiterpollen statt crashen
**Commits:** `7869d27`, `609801c`

#### Fix: maxResults auf 300 erhöht
**Datei:** `app/api/research/run/route.ts`
- Rohmaterial von 30 → 300 damit nach allen Filtern genug saubere Ads übrig bleiben

#### Fix: Video-Download Headers
**Datei:** `lib/agents/videoStorage.ts`
**Problem:** Nur `User-Agent` Header → Facebook CDN blockt Requests ohne `Referer`
**Fix:** Vollständige Browser-Headers hinzugefügt:
```typescript
'Referer': 'https://www.facebook.com/',
'Accept': 'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8',
'Sec-Fetch-Dest': 'video',
'Sec-Fetch-Mode': 'no-cors',
```
Timeout: 60s → 90s

#### Fix: Video-Erkennung erweitert
**Datei:** `app/api/research/run/route.ts`
Neue Patterns: `'"videos"'`, `'video_preview'`, `'"video":{'`

#### Fix: Validierung vor Session-Erstellung
**Datei:** `app/api/research/run/route.ts`
- Pflichtfeld-Validierung jetzt vor Session-Insert (verhindert leere Sessions bei fehlendem targetProduct)

### Aktueller Stand `lib/agents/apify.ts`
```typescript
// Async start, kein waitForFinish
// Polling: alle 10s, max 55 Versuche = 550s
// Jeder Poll: 15s AbortController Timeout
// Bei Netzwerkfehler: weiterpollen
// Parameter: count (nicht maxResults!)
// 1 URL pro Call (searchTerms[0])
// Mit Datumsfilter: active_status=all + start_date[min/max]
```

### Letzte Git-Commits dieser Session
```
4e30818  Fix duration tolerance: max +3s fallback only
70ee95c  Relax video duration limit (wurde sofort korrigiert)
03b7ac1  Fix video download: add Facebook CDN headers, add duration options
dfdfadf  Broaden product relevance keywords + increase maxResults to 100
609801c  Fix Apify polling: add 15s timeout + retry on network errors
a09f9fc  Fix Apify: use 'count' instead of 'maxResults' parameter
7869d27  Fix Apify timeout: async start + 550s polling window
d91027e  Fix: move validation before session creation in research route
b719fd1  Add research sessions: session tracking in researcher, session picker in analyst UI
374d087  Fix Apify timeout: maxResults 30->10, fallback only on 0 results
f181a6d  Add date range picker to researcher: Black Friday / historical ad search support
6bdf04d  Add video duration filter: min 5s hardcoded, max duration UI dropdown
7e22847  Fix researcher: add product-relevance filter and product-specific fallback keywords
a67bd22  Increase raw material limit to 300 results from Apify
```

---

## 1. Projekt-Überblick

**KANA.AI** ist eine Next.js 15 SaaS-Plattform (TypeScript, Clerk Auth, Supabase, Railway, Stripe, Anthropic API).
Sie hostet KI-Agents die Kunden kaufen/nutzen können.

**Primärer Kunde/Use-Case:** Sins 'n Lashes (SNL) — Beauty-Marke, Wimpernserum.
Die SNL-Agents sind Admin-only (nicht öffentlich kaufbar) und laufen als internes Marketing-Tool.

**Repo:** GitHub → Railway (auto-deploy bei `git push origin main`)
**Working Directory:** `C:\Users\ALEX\OneDrive\Desktop\KANA.AI`

---

## 2. SNL Creative Pipeline (vollständig implementiert)

```
Brand Expert          → liest brand_knowledge (Supabase)
        ↓
Creative Researcher   → findet Competitor-Ads via Apify, lädt Videos, speichert in ad_research
        ↓
Creative Analyst      → liest analyst_knowledge + brand_knowledge + ad_research
                      → K1-K6 Scoring → speichert in analyst_results
        ↓
Creative Strategist   → liest strategist_knowledge + brand_knowledge + analyst_results
                      → 5 Stages Framework → 20/10/2 Creative Briefs → PDF-Download
```

---

## 3. Alle Agents — Status, Routes, Dateien

### 3a. Brand Expert
- **Route:** `/chat/custom_brand_expert`
- **API:** `app/api/brand-expert/run/route.ts`
- **Agent-Lib:** `lib/agents/brandExpert.ts`
- **Supabase-Tabelle:** `brand_knowledge`
- **Seed-Script:** `Brand experte railway/seed_supabase.js`
- **Admin-Sidebar:** ✅ `🧠 Brand Expert`

### 3b. Creative Researcher
- **Route:** `/chat/custom_creative_researcher`
- **API:** `app/api/research/run/route.ts`
- **Helper-Libs:** `lib/agents/apify.ts`, `lib/agents/gemini.ts`, `lib/agents/videoStorage.ts`
- **Supabase-Tabelle:** `ad_research` ← **speichert hier** (nicht analyst_breakdowns!)
- **UI:** `app/components/agents/ResearchAgent.tsx`
- **Sessions-API:** `app/api/research/sessions/route.ts`

### 3c. Creative Analyst
- **Route:** `/chat/custom_creative_analyst`
- **API:** `app/api/creative-analyst/run/route.ts`
- **Agent-Lib:** `lib/agents/creativeAnalyst.ts`
- **Supabase-Tabellen:** liest `analyst_knowledge` + `brand_knowledge` + `ad_research`, schreibt in `analyst_results`
- **Seed-Script:** `Brand experte railway/seed_analyst.js`
- **Admin-Sidebar:** ✅ `🔬 Creative Analyst`
- **UI:** `app/components/agents/CreativeAnalyst.tsx` — blauer Theme, Session-Picker + "🔬 Breakdowns analysieren"

### 3d. Creative Strategist
- **Route:** `/chat/custom_creative_strategist`
- **API:** `app/api/creative-strategist/run/route.ts`
- **Agent-Lib:** `lib/agents/creativeStrategist.ts`
- **Supabase-Tabellen:** liest `strategist_knowledge` + `brand_knowledge` + `analyst_results`
- **Seed-Script:** `Brand experte railway/seed_strategist.js`
- **Admin-Sidebar:** ✅ `🎯 Creative Strategist`
- **UI:** `app/components/agents/CreativeStrategist.tsx` — goldener Theme, 3 Buttons

---

## 4. Dashboard-Routing (`app/chat/[agentId]/page.tsx`)

```tsx
import CreativeStrategist from "@/app/components/agents/CreativeStrategist";
import CreativeAnalyst from "@/app/components/agents/CreativeAnalyst";
// ...
if (agentId === "custom_creative_strategist") return <CreativeStrategist />;
if (agentId === "custom_creative_analyst") return <CreativeAnalyst />;
```

---

## 5. Admin Sidebar (`app/components/dashboard/PortalDashboard.tsx`)

Im `{isAdmin && (...)}` Block stehen folgende Links:
```tsx
<a href="/chat/custom_brand_expert"         className="sidebar-item">🧠 Brand Expert</a>
<a href="/chat/custom_creative_strategist"  className="sidebar-item">🎯 Creative Strategist</a>
<a href="/chat/custom_creative_analyst"     className="sidebar-item">🔬 Creative Analyst</a>
```

---

## 6. Supabase-Tabellen (vollständig)

Datei: `KANA.AI/docs/supabase-schema.sql`

| Tabelle | Zweck | Befüllt durch |
|---|---|---|
| `agent_access` | Wer hat welchen Agent gekauft | Stripe Webhook |
| `sessions` | Agent-Sessions pro User | Chat-Route |
| `brand_knowledge` | SNL Brand Intelligence | `seed_supabase.js` |
| `strategist_knowledge` | REF-Dateien (5 Stages Framework etc.) | `seed_strategist.js` |
| `analyst_knowledge` | Analyse-Framework, K1-K6 Rubrik | `seed_analyst.js` |
| `analyst_breakdowns` | **NICHT VERWENDET** — war ursprünglich für Researcher, jetzt leer | — |
| `analyst_results` | K1-K6 Scoring Ergebnisse (Input für Strategist) | Creative Analyst |
| `ad_research` | Competitor-Ad Daten + Video-Breakdowns | Creative Researcher |
| `research_sessions` | **NEU** — Session-Metadaten pro Researcher-Run | Creative Researcher |

**Supabase URL:** `https://koffbdobhehdcthsrtyh.supabase.co`
**Service Role Key:** in Railway ENV

**WICHTIG `ad_research` Spalten:**
`ad_id, advertiser, target_product, ad_format, start_date, laufzeit_tage, impressionen, varianten, plattformen, ad_text, headline, cta_button, landing_page, video_url, thumbnail_url, video_breakdown, rohdaten, status, datenstatus, bereit_fuer_analyst, research_datum, session_id`

**KEIN `created_at`** — das Datumsfeld heißt `research_datum`! Queries müssen `.order('research_datum', ...)` nutzen.

**`research_sessions` Spalten:** `id, product, ad_format, ad_count, created_at`

---

## 7. Seed-Scripts (`Brand experte railway/`)

```bash
node seed_supabase.js    # brand_knowledge       → Brand Expert
node seed_strategist.js  # strategist_knowledge  → Creative Strategist
node seed_analyst.js     # analyst_knowledge     → Creative Analyst
```

---

## 8. Alle Bugfixes (chronologisch)

### Fix 1–7: (siehe vorherige Session, Stand 2026-06-15)

### Fix 8: Apify Parameter `count` statt `maxResults`
**Datei:** `lib/agents/apify.ts`
**Problem:** Actor ignorierte `maxResults` → scrafte tausende Ergebnisse → 7-18 Minuten Laufzeit
**Fix:** Parameter heißt `count` beim `curious_coder~facebook-ads-library-scraper`

### Fix 9: Apify — async Polling statt waitForFinish
**Datei:** `lib/agents/apify.ts`
**Fix:** Actor async starten → Polling alle 10s × 55 = 550s Max, mit 15s AbortController + Netzwerkfehler-Retry

### Fix 10: Video-Download Facebook CDN Headers
**Datei:** `lib/agents/videoStorage.ts`
**Fix:** `Referer: https://www.facebook.com/` + Browser-Headers → CDN blockiert nicht mehr

---

## 9. Creative Researcher — Details (aktuell)

**Datei:** `app/api/research/run/route.ts`
**UI:** `app/components/agents/ResearchAgent.tsx`

**4 Tools:**
1. `search_facebook_ads` — Apify (`count: 300`), Produkt-Relevanz-Filter, SNL/Retailer-Filter, VIDEO-Check
2. `download_video` — Facebook CDN → Supabase Storage (mit Browser-Headers)
3. `analyze_video` — Gemini AI Video-Analyse → Breakdown-Text
4. `save_ad_research` — speichert in **`ad_research`** + zählt Session-Counter hoch

**Filter-Logik:**
- SNL_KEYWORDS → raus
- RETAILER_KEYWORDS → raus
- `minImpressions` aus UI (default 0)
- Produkt-Relevanz: mindestens 1 produktspezifisches Keyword im Ad-JSON
- VIDEO-Filter: JSON-Scan auf `.mp4`/video-Felder
- Dauer-Filter: min 5s, max aus UI, +3s Toleranz wenn zu wenig Ads

**Apify-Details (`lib/agents/apify.ts`):**
- Async start (kein `waitForFinish`)
- Polling: alle 10s, max 550s, 15s Timeout pro Poll, Retry bei Netzwerkfehler
- Parameter: `count` (nicht `maxResults`!)
- Nur `searchTerms[0]` als URL (1 URL = schnell)
- Mit Datum: `active_status=all` + `start_date[min/max]`
- Ohne Datum: `active_status=active`

**UI-Felder:** Produkt · Anzahl Ads · Format · Min. Impressionen · Max. Videolänge · Zeitraum (Date Picker)

**Ranking:** Laufzeit × 10 + Impressionen × 0.0001 + Varianten × 5

---

## 10. Creative Analyst — Details (aktuell)

**Datei:** `lib/agents/creativeAnalyst.ts`

**4 Tools:**
1. `read_analyst_refs` — Framework, Scoring-Rubrik aus `analyst_knowledge`
2. `read_brand_knowledge` — SNL Brand Intelligence
3. `read_breakdowns(sessionIds?)` — liest `ad_research`, optional gefiltert nach `session_id`
4. `save_analysis` — speichert in `analyst_results`

**Session-Logik:**
- UI zeigt alle `research_sessions` als Karten
- Auswahl → `sessionIds[]` → API → `read_breakdowns` filtert per `.in('session_id', sessionIds)`
- Keine Auswahl → alle unanalysierten Ads

**K1-K6 Scoring-Formel:**
```
Gesamt = (K1×0.30) + (K2×0.20) + (K3×0.15) + (K4×0.20) + (K5×0.10) + (K6×0.05)
```

---

## 11. Creative Strategist — Details

*(unverändert gegenüber vorheriger Session)*

**3 Modi:** 20 Briefs / 10 Briefs / 2 Briefs
**PDF-Export:** jsPDF, A4, goldenes Theme

---

## 12. Datei-Struktur (relevante Dateien, aktuell)

```
KANA.AI/
├── app/
│   ├── api/
│   │   ├── brand-expert/run/route.ts
│   │   ├── creative-strategist/run/route.ts     ← runtime=nodejs, maxDuration=300
│   │   ├── creative-analyst/run/route.ts        ← empfängt sessionIds[]
│   │   ├── research/
│   │   │   ├── run/route.ts                     ← runtime=nodejs, maxDuration=600
│   │   │   └── sessions/route.ts                ← GET /api/research/sessions (NEU)
│   ├── chat/[agentId]/page.tsx
│   └── components/
│       ├── agents/
│       │   ├── ResearchAgent.tsx                ← Produkt, Anzahl, Format, Min.Impressionen, Max.Videolänge, Zeitraum
│       │   ├── CreativeStrategist.tsx
│       │   └── CreativeAnalyst.tsx              ← Session-Picker + Analyse-Button
│       └── dashboard/
│           └── PortalDashboard.tsx
├── lib/
│   └── agents/
│       ├── apify.ts                             ← async polling, count param, date filter
│       ├── creativeStrategist.ts
│       ├── creativeAnalyst.ts                   ← readBreakdowns(sessionIds?)
│       ├── gemini.ts
│       └── videoStorage.ts                      ← Facebook CDN Headers
└── docs/
    └── supabase-schema.sql
```

---

## 13. SSE Streaming Pattern (alle Agent-Routes)

```typescript
export const runtime = 'nodejs'
export const maxDuration = 600  // research: 600, andere: 300

const stream = new ReadableStream({
  async start(controller) {
    function send(data: object) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    }
    try {
      while (true) {
        const response = await anthropic.messages.create({ ... })
        for (const block of response.content) {
          if (block.type === 'text') send({ type: 'progress', message: block.text })
        }
        if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') { break }
        const toolResults = []
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await executeTool(block.name, block.input)
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }
        }
        if (toolResults.length === 0) break
        messages.push({ role: 'assistant', content: response.content })
        messages.push({ role: 'user', content: toolResults })
      }
    } catch (err) { send({ type: 'error', message: String(err) }) }
    finally { controller.close() }
  }
})
```

---

## 14. Tech-Stack

| Tool | Version/Details |
|---|---|
| Next.js | 15, App Router |
| TypeScript | strikt |
| Clerk | Auth, `isAdminUser()` via `ADMIN_USER_IDS` ENV |
| Supabase | `getSupabaseAdmin()` mit Service Role Key |
| Railway | Auto-deploy, `maxDuration: 600` für Research-Route |
| Anthropic | `claude-sonnet-4-6`, Tool Use, SSE Streaming |
| jsPDF | Client-seitig, PDF-Export im Strategist |
| Apify | `curious_coder~facebook-ads-library-scraper`, async polling, `count` Parameter |
| Gemini | Video-Analyse für Researcher |
