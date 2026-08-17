# Creative Strategist — Console-Fassung

**Welle 1.** Quelle: `lib/agents/creativeStrategist.ts` + `app/api/creative-strategist/run/route.ts`, Commit `acc7607`.
Ausführliche Vorlage: `claude/13_Vorlage_Creative-Strategist.md` im Claude-Projekt.

Rein lesend, kein Vault, kein Netzzugang, kein Rückschreibpfad. Deshalb der
erste Agent: Weicht die Gegenprobe ab, liegt es am Transportweg und an nichts
anderem.

## Abbildung alt → neu

| Alt | Neu |
|---|---|
| `read_strategist_refs` | `jq` auf `/workspace/referenzen.json` |
| `read_brand_knowledge` | `jq` auf `/workspace/wissensbasis.json` |
| `read_analyst_results` | `jq` auf `/workspace/analyst-ergebnisse.json` |
| Ausgabe im Chat | Ausgabe im Chat **plus** `/mnt/session/outputs/strategy-guide.md` |
| `buildStrategistSystemPrompt("20"\|"10"\|"2")` | `agent.yaml` + `modes/<N>.md` per `agent_with_overrides` |
| Agentic Loop, `maxDuration = 300` | Managed-Agents-Session + Webhook |

## Kontextdateien (vom Backend beim Session-Start)

| Pfad | Aus | Format |
|---|---|---|
| `/workspace/referenzen.json` | `strategist_knowledge`, nach `key` | `[{key,title,content}]` |
| `/workspace/wissensbasis.json` | `tenant_knowledge` des Mandanten | `[{key,title,content,updated_at}]` |
| `/workspace/analyst-ergebnisse.json` | `analyst_results`, `score` absteigend | `[{ad_id,advertiser,score,klasse,content,created_at}]` |

Ergebnis: `/mnt/session/outputs/strategy-guide.md` → `run_artifacts`.
**Es wird nichts in die Datenbank zurückgeschrieben** — der Altagent tut das auch nicht.

## Environment und Vault

`kana-agents-offline` (siehe `umgebungen/`), kein Vault.

## Bewusste Abweichungen — in der Gegenprobe zu prüfen

1. **Brief-Anzahl steht nicht mehr im Fließtext.** Der Altcode interpoliert
   `${briefCount}` an vier Stellen. Beim Baukasten „Basis + Modus" ist das nicht
   abbildbar, ohne drei fast identische Volltexte zu pflegen. Rückfallebene,
   falls die Anzahl abweicht: drei vollständige System-Prompts, je einer pro
   Modus. **Erst messen, dann entscheiden.**
2. **Schritt 7 ist neu.** Ohne Ergebnisdatei gäbe es in der Console nichts
   abzuholen. Identischer Inhalt, nur zusätzlich als Datei.

**Nicht abgewichen, obwohl es auffällt:** Der Workflow springt von Schritt 4 auf
Schritt 6. Schritt 5 fehlt schon im Altcode. Das bleibt so — Regel R1.

## Nach der Migration zu prüfen

1. Nummerierungslücke Schritt 5.
2. **Schlüsselnamen prüfen — möglicherweise ein echter Fehler.** Der Prompt sucht
   `08_brand_competitors`, `09_brand_strategy`, `10_brand_claims`,
   `11_brand_content_bank`. Der Brand Expert schreibt aber `brand_competitors`,
   `brand_strategy`, `brand_claims`, `brand_content_bank` — **ohne Zahlenpräfix**
   (`lib/agents/brandExpert.ts`, Zeile 86). Findet der Strategist die Einträge
   nicht, fehlt ihm die Konkurrenzlage, ohne dass es auffällt.
   **Vor Welle 1 gegen die echten Daten in `brand_knowledge` prüfen.**
3. „Sins 'n Lashes" ist fest verdrahtet — Mandantenfähigkeit als eigener Schritt.
4. REF-00/06/07/08 als Skill statt als Kontextdatei.
5. Ausgabe als PDF über den `pdf`-Skill.
