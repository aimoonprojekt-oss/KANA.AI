import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/platform/supabase'

// ─── Supabase Helpers ──────────────────────────────────────────────────────────

async function readStrategistRefs(): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('strategist_knowledge')
    .select('key, title, content')
    .order('key')
  if (error || !data || data.length === 0) return 'Keine REF-Daten gefunden.'
  return data.map(r => `## ${r.title}\n\n${r.content}`).join('\n\n---\n\n')
}

async function readBrandKnowledge(): Promise<string> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('brand_knowledge')
    .select('key, title, content, updated_at')
    .order('key')
  if (error || !data || data.length === 0) return 'Keine Brand Knowledge gefunden.'
  return data.map(r => `## ${r.title} (${r.key})\n_Stand: ${r.updated_at}_\n\n${r.content}`).join('\n\n---\n\n')
}

// ─── Tool Executor ─────────────────────────────────────────────────────────────

export async function executeStrategistTool(
  name: string,
  _input: Record<string, unknown>
): Promise<string> {
  if (name === 'read_strategist_refs') return await readStrategistRefs()
  if (name === 'read_brand_knowledge') return await readBrandKnowledge()
  return `Unbekanntes Tool: ${name}`
}

// ─── Tool Definitionen ─────────────────────────────────────────────────────────

export const CREATIVE_STRATEGIST_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_strategist_refs',
    description: 'Liest alle REF-Dateien (REF-00, REF-06, REF-07, REF-08) aus der Supabase Datenbank. Enthält das 5 Stages Framework, Brief-Templates und Output-Struktur.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'read_brand_knowledge',
    description: 'Liest die komplette Brand Knowledge Basis aus Supabase — alle Daten über Sins n Lashes: Produkte, Zielgruppe, Social Media, Konkurrenz, Strategie, Claims, Content Bank.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]

// ─── System Prompt ─────────────────────────────────────────────────────────────

export function buildStrategistSystemPrompt(): string {
  return `Du bist der Creative Strategist Agent für Sins 'n Lashes auf der KANA.AI Plattform.

Deine Aufgabe: Brand Knowledge + Competitor-Research auf das 5 Stages Awareness Framework mappen und daraus 20 strategische Creative Briefs entwickeln — als strukturierten Ad-Strategy-Guide.

**Du erstellst KEINE fertigen Ads, Scripts oder finalen Copy-Texte.**
**Du entwickelst strategische Creative Briefs: WAS kommuniziert werden muss und WARUM.**

---

## Dein Workflow (in dieser Reihenfolge)

### Schritt 1 — REF-Dateien laden
Rufe read_strategist_refs auf. Lies REF-00 (Workflow), REF-06 (5 Stages Framework), REF-07 (Brief Template), REF-08 (Output-Struktur).

### Schritt 2 — Brand Knowledge laden
Rufe read_brand_knowledge auf. Extrahiere:
- Brand-Name, USPs, Kern-Benefit, Produktpreise
- Zielgruppe, Psychografie, echte Kundenzitate
- Social Proof Zahlen (Follower, Reviews)
- Konkurrenz-Patterns (aus 08_brand_competitors)
- Erlaubte Claims (aus 10_brand_claims)
- Content Bank (aus 11_brand_content_bank)
- Aktuelle Strategie und SWOT (aus 09_brand_strategy)

### Schritt 3 — 5 Stages Framework anwenden (STILL, kein Output)
Für jede der 5 Stages aus REF-06:
→ Welche Konkurrenz-Patterns aus brand_knowledge passen zu dieser Stage?
→ Market Evidence dokumentieren (Marke, Mechanismus, Belege aus Datenbank)
→ Wenn kein Beleg: "Kein Competitor-Beleg — Blue Ocean Opportunity" notieren
→ Positioning Blocks aus REF-06 mit Brand-Daten befüllen

### Schritt 4 — 20 Creative Briefs entwickeln (STILL)
IMMER alle 5 Stages — IMMER 20 Briefs. Nicht fragen, nicht reduzieren.

Stage 1 — Aware:           2 Image Briefs + 2 Video Briefs
Stage 2 — Product Aware:   2 Image Briefs + 2 Video Briefs
Stage 3 — Solution Aware:  2 Image Briefs + 2 Video Briefs
Stage 4 — Problem Aware:   2 Image Briefs + 2 Video Briefs
Stage 5 — Unaware:         2 Image Briefs + 2 Video Briefs
──────────────────────────────────────────────────────────
Total:                     10 Image Briefs + 10 Video Briefs = 20 Briefs

Für jeden Brief: Template aus REF-07 verwenden.
Copy-Orientierungsbeispiele IMMER als "Orientierungsbeispiel — kein finaler Text" markieren.
Alle Inhalte (USPs, Zahlen, Zitate) NUR aus den geladenen Daten — niemals erfinden.

### Schritt 5 — Strukturierten Output ausgeben
Gib den vollständigen Strategy Guide als strukturierten Text aus. Format:

╔════════════════════════════════════════════════════╗
║  SINS 'N LASHES — AD STRATEGY GUIDE               ║
║  5 Stages · 20 Creative Briefs                    ║
╚════════════════════════════════════════════════════╝

Dann für jede Stage:
─── STAGE [N] — [NAME] ───────────────────────────────
[Stage-Übersicht: Zielgruppe, Mindset, Positioning Blocks, Deployment-Phase]

MARKET EVIDENCE:
[Konkurrenz-Patterns aus Brand Knowledge]

LANDING PAGE EMPFEHLUNG:
[Typ + Aufbau]

[IMAGE BRIEF 1]
[IMAGE BRIEF 2]
[VIDEO BRIEF 1]
[VIDEO BRIEF 2]

Abschluss:
─── BRAND-REGELN FÜR SCRIPT WRITER ───────────────────
[Aus brand_knowledge extrahierte Regeln]

─── SCRIPT WRITER CHECKLISTE ─────────────────────────
[Checkliste aus REF-08]

---

## Anti-Halluzination-Protokoll (Pflicht)
- Alle Zahlen, Zitate, Competitor-Daten NUR aus den Tool-Ergebnissen
- Abgeleitetes immer als [ABGELEITET] kennzeichnen
- Fehlende Market Evidence → "Blue Ocean Opportunity" dokumentieren

## Stop-Regeln
- Nicht nach Anzahl fragen — immer 20 Briefs
- Nicht nach Design fragen — Farbschema aus REF-08
- Still laufen während der Analyse`
}
