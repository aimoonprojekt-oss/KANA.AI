import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/platform/supabase'

// ─── Supabase Helpers ──────────────────────────────────────────────────────────

async function readAnalystRefs(): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('analyst_knowledge')
    .select('key, title, content')
    .order('key')
  if (error || !data || data.length === 0) return 'Keine Analyst-REF-Daten gefunden.'
  return data.map(r => `## ${r.title}\n\n${r.content}`).join('\n\n---\n\n')
}

async function readBreakdowns(): Promise<string> {
  const db = getSupabaseAdmin()

  // Breakdowns aus ad_research laden (Spalte: video_breakdown)
  const { data: breakdowns } = await db
    .from('ad_research')
    .select('ad_id, advertiser, video_breakdown, created_at')
    .not('video_breakdown', 'is', null)
    .neq('video_breakdown', '')
    .order('created_at', { ascending: false })

  if (!breakdowns || breakdowns.length === 0) return 'KEINE_BREAKDOWNS_VORHANDEN'

  // Bereits analysierte IDs laden
  const { data: done } = await db
    .from('analyst_results')
    .select('ad_id')

  const doneIds = new Set((done ?? []).map(r => r.ad_id))
  const pending = breakdowns.filter(b => !doneIds.has(b.ad_id))

  if (pending.length === 0) {
    return `ALLE_ANALYSIERT: Alle ${breakdowns.length} Breakdowns wurden bereits analysiert. ad_ids: ${breakdowns.map(b => b.ad_id).join(', ')}`
  }

  return pending.map(b =>
    `### BREAKDOWN: ${b.ad_id} | Advertiser: ${b.advertiser}\n\n${b.video_breakdown}`
  ).join('\n\n═══════════════════════════════════════\n\n')
}

async function readBrandKnowledge(): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('brand_knowledge')
    .select('key, title, content')
    .order('key')
  if (error || !data || data.length === 0) return 'Keine Brand Knowledge gefunden.'
  return data.map(r => `## ${r.title} (${r.key})\n\n${r.content}`).join('\n\n---\n\n')
}

async function saveAnalysis(input: Record<string, unknown>): Promise<string> {
  const db = getSupabaseAdmin()
  const { ad_id, advertiser, score, klasse, content } = input as {
    ad_id: string; advertiser: string; score: number; klasse: string; content: string
  }
  if (!ad_id || !content) return 'Fehler: ad_id und content sind Pflichtfelder.'

  const { error } = await db
    .from('analyst_results')
    .upsert({
      ad_id,
      advertiser: advertiser ?? 'Unbekannt',
      score: score ?? 0,
      klasse: klasse ?? 'Unbekannt',
      content,
      created_at: new Date().toISOString(),
    }, { onConflict: 'ad_id' })

  if (error) return `Fehler beim Speichern: ${error.message}`
  return `✅ Analyse für ${ad_id} (${advertiser}) gespeichert — Score: ${score}/5.0 (${klasse})`
}

// ─── Tool Executor ─────────────────────────────────────────────────────────────

export async function executeAnalystTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  if (name === 'read_analyst_refs')   return await readAnalystRefs()
  if (name === 'read_brand_knowledge') return await readBrandKnowledge()
  if (name === 'read_breakdowns')     return await readBreakdowns()
  if (name === 'save_analysis')       return await saveAnalysis(input)
  return `Unbekanntes Tool: ${name}`
}

// ─── Tool Definitionen ─────────────────────────────────────────────────────────

export const CREATIVE_ANALYST_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_analyst_refs',
    description: 'Liest alle REF-Dateien des Creative Analyst aus Supabase: Analyse-Framework, Hook-Swipe-File, Scoring-Rubrik (K1-K6), Format-Glossar, Negativ-Beispiele, Brand & Industry Context, Produkt-Info.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_brand_knowledge',
    description: 'Liest die komplette Brand Knowledge Basis aus Supabase — SNL Produkte, USPs, Zielgruppe, Psychografie, Konkurrenz-Daten, erlaubte Claims und Content Bank. Wird genutzt um Competitor-Stärken und -Schwächen direkt gegen SNL abzugleichen.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_breakdowns',
    description: 'Liest alle noch nicht analysierten Breakdown-Dateien aus Supabase (analyst_breakdowns Tabelle). Gibt KEINE_BREAKDOWNS_VORHANDEN zurück wenn die Tabelle leer ist, oder ALLE_ANALYSIERT wenn alle Breakdowns bereits verarbeitet wurden.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'save_analysis',
    description: 'Speichert eine fertige Ad-Analyse in Supabase (analyst_results Tabelle). Muss nach jeder vollständigen K1-K6 Analyse aufgerufen werden.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_id:      { type: 'string', description: 'Ad-ID aus der Breakdown-Datei' },
        advertiser: { type: 'string', description: 'Name des Advertisers/Brand' },
        score:      { type: 'number', description: 'Gewichteter Gesamt-Score (1.0–5.0)' },
        klasse:     { type: 'string', description: 'Score-Klasse: Ausnahme-Ad / Starke Ad / Durchschnittliche Ad / Schwache Ad / Keine Relevanz' },
        content:    { type: 'string', description: 'Vollständige Analyse als Markdown-Text (K1-K6 Scoring, Hook-Analyse, Copy-Analyse, Wettbewerbs-Einordnung, Empfehlungen)' },
      },
      required: ['ad_id', 'advertiser', 'score', 'klasse', 'content'],
    },
  },
]

// ─── System Prompt ─────────────────────────────────────────────────────────────

export function buildAnalystSystemPrompt(): string {
  return `Du bist der SNL Creative Analyst Agent auf der KANA.AI Plattform.

Deine Aufgabe: Competitor-Ads analysieren — K1-K6 Scoring durchführen, Stärken/Schwächen herausarbeiten und konkrete Empfehlungen für Sins 'n Lashes ableiten.

**ABSOLUTES AUSSCHLUSS-PRINZIP: Ads von Sins 'n Lashes (sinsnlashes.com, @sinsnlashes, "Sins n Lashes") werden NIEMALS analysiert. Sofort überspringen.**

**ANTI-HALLUZINATION: Nur analysieren was tatsächlich in der Breakdown-Datei steht. Kein Raten, kein Ergänzen.**

---

## Workflow

### Schritt 1 — REF-Dateien laden
Rufe read_analyst_refs auf. Lade: Analyse-Framework (8 Schritte), Scoring-Rubrik (K1-K6), Hook-Swipe-File, Format-Glossar.

### Schritt 2 — Brand Knowledge laden
Rufe read_brand_knowledge auf. Extrahiere:
- SNL USPs, Kern-Benefit, Produktpreise, Hero Product
- Zielgruppe, Psychografie, Pain Points, Kaufmotive
- Bekannte Konkurrenten und deren Positionierung (aus 08_brand_competitors)
- Erlaubte Claims (aus 10_brand_claims) — was SNL kommunizieren darf
- Marken-DNA: was ist ON-BRAND / OFF-BRAND für SNL
Diese Daten sind die Referenz für alle Wettbewerbs-Einordnungen und SNL-Empfehlungen.

### Schritt 3 — Breakdowns laden
Rufe read_breakdowns auf.
- KEINE_BREAKDOWNS_VORHANDEN → informiere den User und stoppe.
- ALLE_ANALYSIERT → informiere den User, alle Breakdowns sind verarbeitet.
- Sonst: liste die zu analysierenden Ads auf.

### Schritt 4 — K1-K6 Scoring (für jede Breakdown-Datei)
Nutze Brand Knowledge aktiv beim Scoring:
- Wettbewerbs-Einordnung: Competitor-Stärken/Schwächen DIREKT gegen SNL-USPs abgleichen
- Empfehlungen: nur Hooks/Formeln empfehlen die mit SNL ON-BRAND und erlaubten Claims kompatibel sind
- Differenzierung: wo SNL klar besser ist als der Competitor konkret benennen

Scoring-Formel: Gesamt-Score = (K1×0.30) + (K2×0.20) + (K3×0.15) + (K4×0.20) + (K5×0.10) + (K6×0.05)

Score-Klassen:
- 4.5–5.0 → Ausnahme-Ad
- 3.5–4.4 → Starke Ad
- 2.5–3.4 → Durchschnittliche Ad
- 1.5–2.4 → Schwache Ad
- 1.0–1.4 → Keine Relevanz

### Schritt 5 — Für jede Ad: save_analysis aufrufen
Speichere die vollständige Analyse mit:
- ad_id, advertiser, score (Float), klasse (Text), content (vollständiger Markdown-Report)

Der content muss enthalten:
- K1-K6 Scoring-Tabelle mit Begründungen
- Warum funktioniert diese Ad?
- Hook-Analyse (Typ, Schmerz/Wunsch, Hook-Text verbatim, Stärke/Schwäche)
- Copy-Analyse (Formel, Trigger, Struktur, Stärken/Schwächen)
- Format-Analyse
- Wettbewerbs-Einordnung (Stärken/Schwächen vs. SNL, Kommunikationsvorteil für SNL)
- Empfehlungen für SNL (konkret, nicht generisch)

### Schritt 6 — Abschluss ausgeben

Zeige Zusammenfassung:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SNL Creative Analyst abgeschlossen
Analysiert: [N] Ads
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Für jede Ad:
• [Advertiser] ([ad_id]) — Score: [X.X]/5.0 — [Klasse]

Top-Empfehlung:
[Die wichtigste einzelne Empfehlung aus dieser Analyse-Session]

Falls ≥ 2 Ads mit Score ≥ 3.0: füge Trend-Report hinzu:
- Hook-Trend, Format-Trend, Copy-Trend, Trust-Trend, Aufsteigender Trend

---

## Qualitätsregeln

**Konkret statt generisch:**
- ❌ "Guter Hook" → ✅ "Schmerz-Hook: 'Meine Wimpern waren nach Extensions komplett zerstört' — trifft Extension-Reue direkt"
- ❌ "Schwache Visuals" → ✅ "Kein Before/After — visueller Transformationsbeweis fehlt komplett. Begrenzt K2 auf max. 3/5"

**Empfehlungen mit Beispiel:**
- ❌ "SNL sollte mehr UGC machen"
- ✅ "SNL sollte Schmerz-Hook testen: 'Meine Extensions haben meine Wimpern ruiniert' — Competitor [X] nutzt diesen Mechanismus und läuft seit [N] Tagen"`
}
