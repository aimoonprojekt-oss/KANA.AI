# Creative Researcher — Console-Fassung

**Welle 4, der schwerste.** Quelle: `app/api/research/run/route.ts` (453 Z.) +
`lib/agents/apify.ts`, `gemini.ts`, `videoStorage.ts`, Commit `acc7607`.
Ausführliche Vorlage: `claude/15_Vorlage_Creative-Researcher.md`.

## Der Kernpunkt

Der größte Teil der Logik stand nie im Prompt, sondern in TypeScript unterhalb
der Tools: Ausschlusslisten, Produktkategorie-Filter, Videoprüfung, Rangformel.
**Diese Logik bleibt Code** — `werkzeuge/filter.js` — und wandert nicht in den
Prompt. Ein Sprachmodell rechnet `Laufzeit × 10 + Impressionen × 0,0001 +
Varianten × 5` ungefähr richtig und bei jedem Lauf ein bisschen anders.

## Abbildung alt → neu

| Alt | Neu |
|---|---|
| `search_facebook_ads` | `werkzeuge/apify-suche.sh` + `werkzeuge/filter.js` |
| `SNL_KEYWORDS`, `RETAILER_KEYWORDS`, Produktfilter, Rangformel | `werkzeuge/filter.js` — **Code bleibt Code** |
| `download_video` | `curl` auf `*.fbcdn.net` |
| Supabase Storage als öffentliches Zwischenlager | **Gemini Files API** |
| `analyze_video` | `werkzeuge/video-analyse.sh` |
| `save_ad_research` | Datei `/mnt/session/outputs/ads/<ad_id>.json` |
| Zähler in `research_sessions` | Backend beim Übernehmen |
| `POST /api/research/reanalyze` | **bleibt im Backend** — kein Agent beteiligt |
| `getVideoUrls()` in `apify.ts` | **wird nicht überführt** — toter Code, nirgends aufgerufen |

## Kontextdateien

| Pfad | Inhalt |
|---|---|
| `/mnt/session/uploads/auftrag.json` | `{targetProduct, adCount, adType, minImpressions, maxVideoDuration, startDateMin, startDateMax, country}` |
| `/mnt/session/uploads/bekannte-ads.json` | `["123","456"]` — aus `SELECT ad_id FROM ad_research` |
| `/mnt/session/uploads/*` | die drei Skripte aus diesem Ordner |

Ergebnis: `/mnt/session/outputs/ads/<ad_id>.json` und `…/videos/<ad_id>.mp4`.

## Environment und Vault

`kana-agents-research`. Vault mit `APIFY_API_TOKEN` und `GEMINI_API_KEY`,
**beide nur im Header** — Apify als `Authorization: Bearer`, Gemini als
`x-goog-api-key`. Der Altcode hängt beide als Query-Parameter an; im Container
schlägt das fehl, weil Vault-Werte nur in Header eingesetzt werden.

## Bewusste Abweichungen

1. **Filterlogik als Skript.** Derselbe Code, anderer Ort. Die Gegenprobe muss
   zeigen: **dieselben ad_ids in derselben Reihenfolge.** Eine Abweichung hier ist
   ein Übertragungsfehler in `filter.js`, sonst nichts.
2. **Gemini bekommt das Video über die Files API** statt über eine öffentliche
   Supabase-URL. Prompt, Modell, Temperatur und Token-Grenze sind identisch.
   Nebeneffekt: Die Videos liegen nicht mehr öffentlich lesbar im Storage.
   *Vor Welle 4 prüfen:* wie lange Gemini hochgeladene Dateien vorhält.
3. **Rohdaten bleiben in Dateien** statt im Kontext. Größter Kostenhebel dieser
   Welle — die Gegenprobe sollte deshalb auch die Tokenzahl vergleichen.
4. **Mehrere Suchrunden in getrennten Dateien.** Der automatische zweite
   Apify-Aufruf bei null Treffern (Altcode Z. 167–176) steckt nicht im Skript; er
   ist durch die Prompt-Regel „bei zu wenig Treffern mit anderen Keywords erneut
   suchen" abgedeckt. Weicht die Gegenprobe ab: Fallback in `apify-suche.sh`
   nachziehen, **nicht** den Prompt ändern.

## Nach der Migration zu prüfen

1. `getVideoUrls()` entfernen — toter Code. Die Angabe „Apify (2 Actors)" in
   `claude/08_…` gehört korrigiert.
2. **Rechtsprüfung des Ad-Library-Auslesens vor Welle 4**, nicht danach — es ist
   der einzige Agent, bei dem eine negative Antwort die Arbeit wertlos macht.
3. SNL-Hardcoding in `filter.js` nach `auftrag.json` verschieben. Bei einer
   Skriptdatei ist das einfach: eine Konstante wird ein Parameter.
4. Supabase-Bucket `ad-videos` ist öffentlich lesbar.
