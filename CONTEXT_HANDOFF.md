# KANA.AI — Vollständiger Kontext-Handoff
> Für neues Chat-Fenster. Enthält alles was aus den vorherigen Sessions bekannt ist.
> Stand: 2026-06-15

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

### 3c. Creative Analyst
- **Route:** `/chat/custom_creative_analyst`
- **API:** `app/api/creative-analyst/run/route.ts`
- **Agent-Lib:** `lib/agents/creativeAnalyst.ts`
- **Supabase-Tabellen:** liest `analyst_knowledge` + `brand_knowledge` + `ad_research`, schreibt in `analyst_results`
- **Seed-Script:** `Brand experte railway/seed_analyst.js`
- **Admin-Sidebar:** ✅ `🔬 Creative Analyst`
- **UI:** `app/components/agents/CreativeAnalyst.tsx` — blauer Theme, Single Button "🔬 Breakdowns analysieren"

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

**Supabase URL:** `https://koffbdobhehdcthsrtyh.supabase.co`
**Service Role Key:** in Railway ENV

**WICHTIG `ad_research` Spalten** (was der Researcher speichert):
`ad_id, advertiser, target_product, ad_format, start_date, laufzeit_tage, impressionen, varianten, plattformen, ad_text, headline, cta_button, landing_page, video_url, thumbnail_url, video_breakdown, rohdaten, status, datenstatus, bereit_fuer_analyst, research_datum`

**KEIN `created_at`** — das Datumsfeld heißt `research_datum`! Queries müssen `.order('research_datum', ...)` nutzen.

---

## 7. Seed-Scripts (`Brand experte railway/`)

```bash
node seed_supabase.js    # brand_knowledge       → Brand Expert
node seed_strategist.js  # strategist_knowledge  → Creative Strategist
node seed_analyst.js     # analyst_knowledge     → Creative Analyst
```

---

## 8. Alle Bugfixes (chronologisch)

### Fix 1: Research Route — Edge Runtime
**Datei:** `app/api/research/run/route.ts`
**Problem:** Route lief auf Edge Runtime → SSE-Verbindung brach sofort ab.
**Fix:** `export const runtime = 'nodejs'` + `export const maxDuration = 600` (wurde von 300 auf 600 erhöht)
**Commit:** `07ae08e`

### Fix 2: Strategist — 400 Error leere user-messages
**Datei:** `app/api/creative-strategist/run/route.ts`
**Fix:** `if (response.stop_reason !== 'tool_use') { break }` + `if (toolResults.length === 0) break`

### Fix 3: Apify Timeout — waitForFinish
**Datei:** `lib/agents/apify.ts`
**Problem:** `runActor` pollte bis zu 600s → Railway killt nach 300s → "TypeError: network error"
**Fix:**
- `waitForFinish=200` im Apify-Start-Call (Apify hält Verbindung server-seitig offen)
- Fallback-Polling nur noch 18 × 5s = 90s
- `maxResults` von 80 auf 30 reduziert
**Commits:** `22ad3b5`, `7c14fbe`

### Fix 4: Apify — nur 1 URL pro Call
**Datei:** `lib/agents/apify.ts`
**Problem:** Mehrere Keywords = mehrere URLs = Apify scrapet mehrere Facebook-Seiten gleichzeitig → >200s
**Fix:** Nur `searchTerms[0]` als URL übergeben — 1 URL statt N
**Commit:** `4ac0224`

### Fix 5: VIDEO-Filter filterte alle Ads raus
**Datei:** `app/api/research/run/route.ts`
**Problem:** Filter prüfte auf `video_hd_url`/`video_sd_url`/`video_preview_image_url` — Felder die Apify so nicht liefert → 0 Ergebnisse bei VIDEO-Suche
**Fix:** Neuer robuster Filter: scannt komplettes Ad-Objekt als JSON-String nach `.mp4` oder `video_url`
```typescript
const raw = JSON.stringify(ad).toLowerCase()
const hasVideo = raw.includes('.mp4') || raw.includes('video_hd_url') || raw.includes('video_sd_url') || raw.includes('"video_url"') || raw.includes('"videourl"')
if (!hasVideo) return false
```
**Commit:** `745e040`

### Fix 6: Min. Impressionen — UI-Feld
**Dateien:** `app/components/agents/ResearchAgent.tsx`, `app/api/research/run/route.ts`
**Feature:** Neues Dropdown "Min. Impressionen" (Keine Grenze / 10k / 50k / 150k / 300k)
**Default:** 0 (keine Grenze) — vorher war 150.000 hardcoded
**Commit:** `27d272a`

### Fix 7: Analyst las falsche Tabelle
**Datei:** `lib/agents/creativeAnalyst.ts`
**Problem:** Analyst las aus `analyst_breakdowns` (leer) statt `ad_research` (wo Researcher speichert)
**Fix:**
- Query auf `ad_research` umgestellt
- Alle Felder selektiert (nicht nur `video_breakdown`)
- Order by `research_datum` (nicht `created_at` — existiert nicht in der Tabelle!)
- Fehler-Logging hinzugefügt: `if (breakdownError) return 'FEHLER: ...'`
- Analyst baut Breakdown-Text aus allen verfügbaren Feldern zusammen (funktioniert auch ohne Video-Breakdown)
**Commits:** `8df4d0f`, `e7050af`, `3f3bc8d`, `9f882f6`, `cbd9fe6`

---

## 9. Creative Researcher — Details

**Datei:** `app/api/research/run/route.ts`
**UI:** `app/components/agents/ResearchAgent.tsx`

**4 Tools:**
1. `search_facebook_ads` — Apify, filtert SNL-eigene Ads + Retailer, VIDEO-Check via JSON-Scan
2. `download_video` — Facebook CDN → Supabase Storage
3. `analyze_video` — Gemini AI Video-Analyse → Breakdown-Text
4. `save_ad_research` — speichert in **`ad_research`** (upsert on `ad_id`)

**Filter-Logik:**
- SNL_KEYWORDS: `['sinsnlashes', 'sins n lashes', 'sins & lashes', 'sinsnlashes.com']` → raus
- RETAILER_KEYWORDS: `['rossmann', 'müller', 'douglas', 'dm ', 'drogerie', 'amazon', 'otto']` → raus
- `minImpressions` aus UI (default 0 = keine Grenze)
- VIDEO-Filter: JSON.stringify(ad) auf `.mp4`/video-Felder scannen

**Apify-Details (`lib/agents/apify.ts`):**
- `waitForFinish=200` → Apify wartet server-seitig
- Fallback-Polling: 18 × 5s = 90s max
- Nur `searchTerms[0]` wird als URL übergeben (1 URL = schnell)
- `maxResults: 30`

**UI-Felder:** Produkt, Anzahl Ads, Format (VIDEO/IMAGE), **Min. Impressionen** (NEU)

**Ranking:** Laufzeit × 10 + Impressionen × 0.0001 + Varianten × 5

**Status-Feld in `ad_research`:**
- `'breakdown_complete'` wenn Video-Breakdown vorhanden
- `'research_complete'` wenn nur Library-Daten

---

## 10. Creative Analyst — Details

**Datei:** `lib/agents/creativeAnalyst.ts`

**4 Tools:**
1. `read_analyst_refs` — Framework, Scoring-Rubrik, Hook-Swipe-File aus `analyst_knowledge`
2. `read_brand_knowledge` — SNL Brand Intelligence (für Competitor-Benchmarking)
3. `read_breakdowns` — liest aus **`ad_research`**, alle Felder, order by `research_datum`, filtert bereits analysierte IDs
4. `save_analysis` — speichert in `analyst_results` mit upsert on `ad_id`

**Was `read_breakdowns` zurückgibt:**
- `KEINE_BREAKDOWNS_VORHANDEN` wenn `ad_research` leer
- `FEHLER: [message]` wenn Supabase-Query fehlschlägt
- `ALLE_ANALYSIERT` wenn alle IDs bereits in `analyst_results`
- Sonst: strukturierter Text mit allen Feldern pro Ad, Video-Breakdown wenn vorhanden

**K1-K6 Scoring-Formel:**
```
Gesamt = (K1×0.30) + (K2×0.20) + (K3×0.15) + (K4×0.20) + (K5×0.10) + (K6×0.05)
```
Score-Klassen: 4.5–5.0 Ausnahme | 3.5–4.4 Stark | 2.5–3.4 Durchschnitt | 1.5–2.4 Schwach | 1.0–1.4 Keine Relevanz

**ABSOLUTES AUSSCHLUSS-PRINZIP:** Ads von SNL selbst niemals analysieren.

---

## 11. Creative Strategist — Details

**Datei:** `lib/agents/creativeStrategist.ts`

**3 Tools:**
1. `read_strategist_refs` — REF-Dateien (5 Stages Framework)
2. `read_brand_knowledge` — komplette SNL Brand Intelligence
3. `read_analyst_results` — K1-K6 Ergebnisse vom Analyst

**3 Modi (UI: 3 Buttons):**
- `"20"` → 5 Stages × 2 Image + 2 Video = 20 Briefs, max_tokens: 16000
- `"10"` → 5 Stages × 1 Image + 1 Video = 10 Briefs, max_tokens: 10000
- `"2"` → Stage 1 × 1 Image + 1 Video = 2 Briefs, max_tokens: 6000

**PDF-Export:** jsPDF clientseitig, A4, goldenes Theme.
Dateiname: `SinsNLashes_Ad-Strategy-Guide_YYYY-MM-DD.pdf`

---

## 12. Offene TODOs

1. **Researcher end-to-end testen** — mit "Keine Grenze" Impressionen, Wimpernserum, 2 Ads. Muss bis `save_ad_research` durchlaufen und Daten in `ad_research` speichern.
2. **`node seed_analyst.js` ausführen** — falls noch nicht gemacht (aus `Brand experte railway/`)
3. **Creative Analyst testen** — setzt voraus dass `ad_research` Daten hat
4. **End-to-End:** Researcher → Analyst → Strategist komplett durchlaufen

**Wahrscheinliche Ursache wenn Analyst "KEINE_BREAKDOWNS_VORHANDEN" zeigt:**
`ad_research` ist leer weil der Researcher noch nie erfolgreich bis `save_ad_research` durchgelaufen ist (alle früheren Runs hatten Timeouts oder VIDEO-Filter-Bug).

---

## 13. Datei-Struktur (relevante Dateien)

```
KANA.AI/
├── app/
│   ├── api/
│   │   ├── brand-expert/run/route.ts
│   │   ├── creative-strategist/run/route.ts  ← runtime=nodejs, maxDuration=300
│   │   ├── creative-analyst/run/route.ts
│   │   └── research/run/route.ts             ← runtime=nodejs, maxDuration=600
│   ├── chat/[agentId]/page.tsx
│   └── components/
│       ├── agents/
│       │   ├── ResearchAgent.tsx              ← Produkt, Anzahl, Format, Min.Impressionen
│       │   ├── CreativeStrategist.tsx         ← 3-Button Grid, jsPDF, goldener Theme
│       │   └── CreativeAnalyst.tsx            ← Blauer Theme, Single Button
│       └── dashboard/
│           └── PortalDashboard.tsx
├── lib/
│   └── agents/
│       ├── apify.ts                           ← waitForFinish=200, maxResults=30, 1 URL pro Call
│       ├── creativeStrategist.ts
│       ├── creativeAnalyst.ts                 ← liest ad_research, order by research_datum
│       ├── gemini.ts
│       └── videoStorage.ts
└── docs/
    ├── supabase-schema.sql                    ← Schema (ad_research ist NICHT drin — existiert aber!)
    └── ANLEITUNG.md

Brand experte railway/
├── seed_supabase.js
├── seed_strategist.js
└── seed_analyst.js
```

---

## 14. SSE Streaming Pattern (alle Agent-Routes)

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

## 15. Tech-Stack

| Tool | Version/Details |
|---|---|
| Next.js | 15, App Router |
| TypeScript | strikt |
| Clerk | Auth, `isAdminUser()` via `ADMIN_USER_IDS` ENV |
| Supabase | `getSupabaseAdmin()` mit Service Role Key |
| Railway | Auto-deploy, `maxDuration: 600` für Research-Route |
| Anthropic | `claude-sonnet-4-6`, Tool Use, SSE Streaming |
| jsPDF | Client-seitig, PDF-Export im Strategist |
| Apify | `curious_coder~facebook-ads-library-scraper`, `waitForFinish=200` |
| Gemini | Video-Analyse für Researcher |

---

## 16. Letzte Git-Commits (aktuell, Stand 2026-06-15)

```
cbd9fe6  Fix analyst: order by research_datum not created_at, add error logging
9f882f6  Fix: researcher→ad_research, analyst reads all fields from ad_research
3f3bc8d  Fix analyst: read all ad_research fields, not just video_breakdown
745e040  Fix VIDEO filter: scan full ad object for .mp4/video URLs
27d272a  Add minImpressions filter to Creative Researcher UI and API
4ac0224  Fix Apify speed: only use first search term per call (1 URL instead of N)
7c14fbe  Fix Apify timeout: waitForFinish=200, maxResults 80→30, maxDuration 300→600
22ad3b5  Fix Apify timeout: use waitForFinish=120 to prevent Railway 300s limit
07ae08e  Fix research route: add nodejs runtime, maxDuration, stop_reason guard
```

Branch: `main` → deployed auf Railway
