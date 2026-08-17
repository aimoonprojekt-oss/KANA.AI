# Creative Analyst — Console-Fassung

**Welle 3.** Quelle: `lib/agents/creativeAnalyst.ts` + `app/api/creative-analyst/run/route.ts`, Commit `acc7607`.
Ausführliche Vorlage: `claude/14_Vorlage_Creative-Analyst.md`.

## Abbildung alt → neu

| Alt | Neu |
|---|---|
| `read_analyst_refs` | `jq` auf `/workspace/referenzen.json` |
| `read_brand_knowledge` | `jq` auf `/workspace/wissensbasis.json` |
| `read_breakdowns(sessionIds)` | `/workspace/breakdowns.json`, **vom Backend vorgefiltert** |
| `save_analysis(...)` | Datei `/mnt/session/outputs/analysen/<ad_id>.json` |
| Scoring-Formel im Kopf | `node /workspace/werkzeuge/score.js` |

## `breakdowns.json`

```json
{ "status": "offen", "hinweis": "", "ads": [ { "ad_id": "…", "advertiser": "…",
  "ad_format": "…", "laufzeit_tage": 0, "impressionen": "…", "varianten": 1,
  "plattformen": "…", "headline": "…", "ad_text": "…", "cta_button": "…",
  "landing_page": "…", "video_url": "…", "video_breakdown": "…" } ] }
```

`status`: `offen` · `keine` (= `KEINE_BREAKDOWNS_VORHANDEN`) · `alle_analysiert`.

Welche Ads offen sind, entscheidet **das Backend** — wie heute in
`readBreakdowns()`. Diese Logik gehört nicht in den Prompt.
Ist `video_breakdown` leer, trägt das Backend den Satz
`(Kein Video-Breakdown — analysiere anhand der Library-Daten)` ein, damit sich
das Verhalten nicht ändert.

## Validierung beim Zurückschreiben (Backend)

1. gültiges JSON, `ad_id` und `content` vorhanden
2. **`ad_id` steht in der Liste der dieser Session mitgegebenen Ads** — sonst verwerfen
3. `score` ist Zahl zwischen 1,0 und 5,0
4. `klasse` ist einer der fünf erlaubten Werte
5. Längenbegrenzung für `content`
6. `tenant_id` **aus dem Laufdatensatz**, nie aus der Datei
7. protokollieren, was übernommen und was verworfen wurde

Punkt 2 ist neu: Der Altagent konnte über `save_analysis` jede beliebige `ad_id`
überschreiben.

## Bewusste Abweichungen

1. **Gewichtung wird gerechnet statt geschätzt** (`werkzeuge/score.js`). Die Formel
   steht zusätzlich wortgleich im Prompt. Weichen die Scores vom Referenzlauf ab,
   ist das **kein** Migrationsfehler — es zeigt, dass der Altagent falsch
   gerechnet hat. Dokumentieren, nicht zurückdrehen.
2. **Statuswerte statt Signaltexte** (`KEINE_BREAKDOWNS_VORHANDEN` → `status`).
3. **Eine Datei je Ad statt eines Tool-Aufrufs je Ad** — sofort schreiben, nicht
   sammeln. Sonst geht bei einem Abbruch alles verloren statt nur der letzten Ad.

## Nach der Migration zu prüfen

1. **Schlüsselnamen** `08_brand_competitors` / `10_brand_claims` gegen die
   präfixlosen Schlüssel des Brand Expert — derselbe mögliche Fehler wie beim
   Strategisten.
2. Lücke in den Score-Klassen zwischen 4,4/4,5 und 3,4/3,5 (`score.js` gibt dort
   „Unbekannt" zurück).
3. K1–K6-Rubrik als gemeinsamer Skill für Analyst und Strategist.
4. `analyst_breakdowns` wurde nie benutzt — beim Aufräumen entfernen.
