# Übergabeprotokoll — Brand Expert nach Managed Agents

> Erstellt 15.08.2026. Für eine neue Session. Alles hier ist verifiziert, nicht vermutet.

---

## 1. Auftrag

Einen Agent **Ende zu Ende** aus dem bestehenden Code herauslösen und als Managed Agent im **Default-Workspace** der Claude Console anlegen — so, dass er am Ende **funktional identisch** zum heutigen Verhalten ist.

Gewählter Agent: **Brand Expert**. Begründung: vollständigste Implementierung, in eine Lib ausgelagert (nicht in der Route verstreut), Admin-only und damit risikoarm, und mit sechs Tools plus vier Modi komplex genug, dass der Test aussagekräftig ist.

Dies ist ein **Machbarkeits-Test**, kein Produktivumbau. Der alte Pfad bleibt unangetastet, bis der neue nachweislich dasselbe tut.

---

## 2. Ausgangslage (verifiziert)

| | |
|---|---|
| Lokaler Ordner | `/Users/kai/Desktop/Kana AI/agent-platform` |
| Repo | `github.com/aimoonprojekt-oss/KANA.AI`, Branch `main` |
| HEAD | `4afde375e17b8ac5f41b53b0748436c30845b1af` |
| Stand | Lokal, GitHub und die deployte Seite sind **beweisbar identisch** (Bundle-Vergleich am 15.08.). Es gibt keinen neueren Stand. |
| `npx tsc --noEmit` | läuft sauber durch |
| Deployment | Vercel-Projekt `kana-ai` (nicht `kanaai-49uy` — das ist eine Altlast in `.vercel/repo.json`) |

Nicht versioniert und deshalb **nicht verfügbar**: die Seed-Skripte (`seed_supabase.js` etc.), die die `brand_knowledge`-Tabelle befüllen. Sie lagen laut `CONTEXT_HANDOFF.md` in einem Ordner `Brand experte railway/`, der nie committet wurde.

---

## 3. Was der Brand Expert heute tut

**Dateien:**
- Logik + Prompts: `lib/agents/brandExpert.ts` (456 Z.)
- Route: `app/api/brand-expert/run/route.ts` (103 Z.)
- UI: `app/components/agents/BrandExpert.tsx` (224 Z.)
- Erreichbar unter: `/chat/custom_brand_expert`

**Ablauf:** Die UI schickt `{ mode, input }` an die Route. Die Route baut daraus einen System-Prompt (`buildBrandExpertSystemPrompt`) und eine passende erste User-Nachricht, und fährt dann einen eigenen Agentic Loop gegen `claude-sonnet-4-6` (`max_tokens: 8096`) mit eigenem SSE-Streaming.

**Vier Modi** (jeder ein kompletter eigener System-Prompt):

| Modus | Zweck |
|---|---|
| `brand-setup` | Einmaliger Vollaufbau der Wissensbasis, 11 fest nummerierte Scrape-Schritte |
| `weekly-update` | Neu scrapen, mit gespeichertem Stand vergleichen, `[NEU]`/`[GEÄNDERT]` markieren |
| `brand-check` | Prüft einen übergebenen Content-Vorschlag gegen die Brand Voice |
| `brand-update` | Speichert eine übergebene neue Information in die Wissensbasis |

Jeder Modus schreibt ein exakt vorgegebenes Report-Format vor, inklusive ASCII-Rahmen. **Das ist Teil des erwarteten Verhaltens und muss erhalten bleiben.**

**Sechs Tools:**

| Tool | Was es macht |
|---|---|
| `read_brand_knowledge` | liest einen Eintrag aus Supabase `brand_knowledge` (12 feste Keys per Enum) |
| `read_all_knowledge` | liest alle Einträge |
| `write_brand_knowledge` | Upsert in `brand_knowledge` |
| `fetch_website` | HTTP-GET, HTML-Tags strippen, auf 6000 Zeichen kürzen |
| `scrape_meta_ads` | Apify Actor `curious_coder~facebook-ads-library-scraper` |
| `scrape_web` | Apify Actor `apify~rag-web-browser` |

---

## 4. Abbildung auf Managed Agents

**Vor jeder Arbeit das `claude-api` Skill laden.** Managed Agents ist Beta, die API ändert sich — nicht aus dem Gedächtnis arbeiten. Beta-Header: `managed-agents-2026-04-01` (Memory Stores abweichend: `agent-memory-2026-07-22`).

| Heute | Managed Agents |
|---|---|
| `fetch_website` | eingebautes `web_fetch` — direkter Ersatz |
| Eigener SSE-Loop, `maxDuration`, Keepalives | entfällt vollständig |
| Vier Modi = vier System-Prompts | **Ein** Agent. `system` = Basis-Block aus `buildBrandExpertSystemPrompt`. Der modusspezifische Teil geht als erste `user.message` rein. Alternative wären vier Agents — für den 1:1-Test ist die erste Variante näher am Original. |
| `claude-sonnet-4-6` | Für den Test **unverändert lassen**. Modellwechsel würde das Ergebnis verfälschen. Erst nach bestandenem Test auf `claude-opus-5` heben. |

**Die drei Supabase-Tools und die zwei Apify-Tools sind die eigentliche Entscheidung.** Zwei Wege, und die neue Session muss sich bewusst für einen entscheiden:

**Weg A — Custom Tools.** Die Tools werden auf dem Agent deklariert, die Ausführung bleibt bei euch: der Agent sendet `agent.custom_tool_use`, euer Backend führt aus, antwortet mit `user.custom_tool_result`. Näher am heutigen Code, schneller zum Laufen, Secrets bleiben bei euch.
*Aber:* damit läuft **nicht** alles in der Console. Euer Server bleibt im Pfad. Das widerspricht Kais Zielbild.

**Weg B — Vault + eingebaute Tools.** Apify-Token und Supabase-Key als `environment_variable`-Credentials in einem Vault. Der Agent ruft beide REST-APIs selbst per `bash`/`web_fetch` aus der Sandbox; das Secret wird erst beim ausgehenden Request eingesetzt und ist im Container nie sichtbar. Damit läuft tatsächlich alles in der Console.
*Aber:* mehr Umbau, und die Prompts müssen dem Agent sagen, wie er die APIs aufruft, statt fertige Tools zu bekommen.

**Empfehlung:** Weg A für den ersten Durchlauf (Funktionsgleichheit beweisen), Weg B als zweiter Schritt (Zielbild erreichen). Beide Ergebnisse dokumentieren.

Später, nicht jetzt: die `brand_knowledge`-Tabelle wäre ein natürlicher **Memory Store**. Für den 1:1-Test bewusst nicht anfassen.

---

## 5. Blocker und offene Fragen — vor dem Start klären

**1. `APIFY_API_TOKEN` fehlt in `.env.local`.** Verifiziert. Damit können `scrape_meta_ads` und `scrape_web` heute **lokal nicht laufen** — es gibt also keine funktionierende Referenz, gegen die man „verhält sich genauso" prüfen könnte. Der Token muss von Kai kommen, sonst ist der Test für vier der elf Setup-Schritte nicht durchführbar. **Zuerst klären.**

**2. Welcher API-Key gehört zum Default-Workspace?** Der `ANTHROPIC_API_KEY` in `.env.local` gehört laut Memory zum SNL-Workspace, nicht zu Default. API-Keys sind workspace-gebunden. Für den Test wird ein Key aus dem Default-Workspace gebraucht.

**3. Ist der Anthropic-Account eine Organisation?** Die Admin API (für spätere Workspace-Automatisierung) gibt es nicht für Einzelkonten. Für diesen Test noch nicht nötig, aber gleich mitprüfen.

**4. Es braucht ein Environment im Default-Workspace.** Die ID aus dem Memory (`env_01CWvPFKCpvWADf5TtU8ci4i`) gehört zum SNL-Workspace und ist hier nicht verwendbar.

**5. Kleinigkeit:** Die Fehlermeldung in `route.ts:17` nennt Modi, die es nicht gibt (`weekly-scrape | brand-report`). Die echten Modi sind `brand-setup | weekly-update | brand-check | brand-update`. Bei Gelegenheit korrigieren.

---

## 6. Vorgeschlagene Reihenfolge

1. `claude-api` Skill laden
2. Blocker 1 und 2 mit Kai klären
3. **Referenzlauf aufnehmen:** den Brand Expert lokal im Modus `brand-check` starten (der einzige Modus ohne Apify-Abhängigkeit) und Ausgabe sichern. Das ist der Vergleichsmaßstab.
4. Environment im Default-Workspace anlegen
5. `agents/brand-expert.agent.yaml` schreiben, per `ant beta:agents create` anlegen, ID sichern
6. Session starten, `brand-check` mit demselben Input fahren, Ausgabe gegen den Referenzlauf halten
7. Erst wenn das stimmt: Apify-Modi mit Token nachziehen
8. Ergebnis dokumentieren, dann über Weg B entscheiden

---

## 7. Was bereits im Memory liegt

Wird automatisch geladen, nicht neu erarbeiten:

- **multi-workspace-architecture** — die beschlossene Zielarchitektur (Workspace pro Kunde, YAML in Git, Managed Agents als Laufzeit) und warum
- **managed-agents-plattform-fakten** — harte Grenzen (100 Workspaces, Cache-Isolation pro Workspace, Rate-Limits pro Organisation), Abrechnung über Usage-/Cost-API, Branding-Regeln, Hinweis das Skill zu laden
- **dsgvo-datenresidenz-konflikt** — die Website verspricht deutsche Server, Anthropic bietet nur `us`/`global`. Ungelöst, blockiert B2B-Vertrieb, ist für diesen Test aber nicht relevant
- **kana-ai-infrastructure** — Accounts, URLs, Keys

---

## 8. Erwartetes Ergebnis

Ein Agent im Default-Workspace, angelegt aus einer YAML-Datei im Repo, der im Modus `brand-check` dieselbe Bewertung liefert wie der heutige Code — und ein kurzer Vermerk, was dabei nicht 1:1 abbildbar war.
