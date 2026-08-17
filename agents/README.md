# Agents als Managed Agents

Migration der Agents aus `lib/agents/*.ts` und `app/api/*/run/route.ts` in den
MoonAi-Workspace der Claude Console.

**Der alte Pfad bleibt unangetastet.** Die TypeScript-Agents laufen weiter, bis der
Console-Pfad nachweislich dasselbe tut. Dieses Verzeichnis ist additiv.

Ziel-Workspace: `wrkspc_019KKnEG6rCpwp7MKmbpg58C`

## Stand

| Welle | Agent | Quelle | YAML | Angelegt |
|---|---|---|---|---|
| 1 | Creative Strategist | `lib/agents/creativeStrategist.ts` + `api/creative-strategist/run` | ✅ `creative-strategist/` | ⬜ |
| 2 | Brand Expert | `lib/agents/brandExpert.ts` + `api/brand-expert/run` | ✅ `brand-expert.agent.yaml` | ⬜ |
| 3 | Creative Analyst | `lib/agents/creativeAnalyst.ts` + `api/creative-analyst/run` | ✅ `creative-analyst/` | ⬜ |
| 4 | Creative Researcher | `api/research/run/route.ts` (Logik in der Route) | ✅ `creative-researcher/` | ⬜ |
| 5 | Marketing-Abteilung | — (existiert noch nicht) | ⬜ | ⬜ |
| — | Support Agent | `api/support-chat` — nur in der Console | ⬜ `console-ziehen.sh` | ✅ (unbestätigt) |
| — | Widget Agent | `api/widget-chat` — nur in der Console | ⬜ `console-ziehen.sh` | ✅ (unbestätigt) |

> **Support- und Widget-Agent sind bisher nirgends im Repo gesichert.** Ihre
> Definitionen liegen ausschließlich in der Console — genau der ungeschützte
> Bereich aus `claude/06_Console_vs_Plattform_und_Sicherung.md`, Abschnitt 5.
> Mit `scripts/console-ziehen.sh` ins Repo holen.
>
> ⚠️ **`SUPPORT_AGENT_ID` steht nicht in `.env.local.example`** und kommt im
> ganzen Repo nur in `app/api/support-chat/route.ts` vor. Ist die Variable
> nirgends gesetzt, liefert die Route bei jedem Aufruf einen 500er. Ob der
> Agent überhaupt existiert, zeigt `POST /api/admin/sync-agents` — es lädt die
> Agenten aus allen konfigurierten Workspaces in die `agents`-Tabelle.

## Ordnerstruktur

```
agents/<name>/
├── agent.yaml        Definition — Quelle der Wahrheit
├── modes/*.md        Modi, per agent_with_overrides angehaengt
├── werkzeuge/*       deterministische Logik als Skript (NICHT im Prompt)
└── LIESMICH.md       Abbildung alt -> neu, bewusste Abweichungen

umgebungen/*.yaml     Environments je Sicherheitsstufe
scripts/
├── console-ausrollen.sh     Repo -> Console (einziger schreibender Weg)
├── console-ziehen.sh        Console -> Repo (Sicherung, Drift-Erkennung)
├── console-test-bindung.sh  Sind Agenten workspace-gebunden? (nicht dokumentiert)
└── workspace-anlegen.sh     Kunden-Workspace per Admin-API
```

---

## Architektur-Entscheidung: Weg C — Kontext-Übergabe

> **Ersetzt Weg B** vom 15.08.2026. Begründung: `docs/entscheidungen/2026-08-16-agent-ohne-datenbankzugang.md`

Der Agent bekommt **keinen Datenbankzugang**. Die Plattform legt die Wissensbasis
zu Beginn der Session in den Container und übernimmt die Ergebnisse nach dem Lauf
zurück in die Datenbank.

```
Backend                     Anthropic-Session                  Backend
───────                     ─────────────────                  ───────
liest tenant_knowledge  →   /workspace/wissensbasis.json
                            Agent arbeitet
                            /mnt/session/outputs/           →   validiert, upsert
                              wissensbasis/<key>.json           mit tenant_id aus
                                                                dem Lauf
```

**Warum nicht Weg B (Agent ruft Supabase per curl selbst auf):** Dafür bräuchte der
Agent den `SUPABASE_SERVICE_ROLE_KEY`. Dieser Schlüssel umgeht Row Level Security
und gewährt Vollzugriff auf **alle** Mandanten. Die Trennung zwischen Kunden hinge
dann daran, dass ein Sprachmodell die richtige Datenbankabfrage formuliert. Das ist
keine Absicherung.

**Der entscheidende Punkt:** Die `tenant_id` kommt beim Zurückschreiben aus dem
Laufdatensatz im Backend, **nie** aus einer Angabe des Agenten. Selbst ein Agent,
der behauptet, für einen anderen Kunden zu schreiben, kann es nicht.

Nebeneffekte:
- Der Vault enthält nur noch **ein** Credential (Apify) statt zwei.
- `allowed_hosts` verliert den Supabase-Host — ein Ziel weniger.
- Der übergebene Kontext ist gut zwischenspeicherbar, was die Kosten je Lauf senkt.
- Der System-Prompt enthält keine Markendaten mehr und gilt damit für alle
  Mandanten. Das ist Voraussetzung für den Master-Agent ohne Kundenkopien.

### Was das je Tool bedeutet

| Alt (TypeScript-Tool) | Neu |
|---|---|
| `read_brand_knowledge` / `read_all_knowledge` | `/workspace/wissensbasis.json`, gelesen mit `jq` |
| `write_brand_knowledge` | Datei `/mnt/session/outputs/wissensbasis/<key>.json`, Übernahme durch das Backend |
| `fetch_website` | eingebautes `web_fetch` |
| `scrape_meta_ads` | `curl` POST auf Apify Actor `curious_coder~facebook-ads-library-scraper` |
| `scrape_web` | `curl` POST auf Apify Actor `apify~rag-web-browser` |

---

## Der Backend-Vertrag

Beides gehört nach `lib/runs/starten.ts` bzw. in den Webhook-Empfänger — nicht in
die Chat-Route, damit kein Weg an der Kontingentprüfung vorbeiführt.

### Beim Start: Wissensbasis bereitstellen

Das Backend liest die Einträge des Mandanten und legt sie als
`/workspace/wissensbasis.json` in die Session:

```json
[
  { "key": "overview",       "title": "Marke auf einen Blick", "content": "…", "updated_at": "2026-08-16T09:00:00Z" },
  { "key": "brand_identity", "title": "Markenidentität",       "content": "…", "updated_at": "2026-08-15T12:00:00Z" }
]
```

Wie die Datei in den Container kommt — Files-API beim Session-Start oder als erstes
`initial_event` — ist Sache des Backends und in `lib/runs/starten.ts` gekapselt. Der
Agent kennt nur den Pfad.

**Schwelle:** Übersteigt die Wissensbasis eines Mandanten etwa 50.000 Zeichen, wird
auf einen Memory Store umgestellt. Bis dahin ist die Datei die einfachere Lösung.
Der Code warnt bei Überschreiten.

### Nach dem Lauf: Ergebnisse übernehmen

Ausgelöst durch den Anthropic-Webhook, nicht durch Warten im Request:

1. Dateien unter `outputs/wissensbasis/` abholen
2. **Validieren** — und zwar serverseitig, nicht im Vertrauen auf den Agenten:
   - `key` steht in der Liste der zwölf erlaubten Werte, sonst verwerfen
   - gültiges JSON, `content` ist ein String
   - Längenbegrenzung je Eintrag
   - `tenant_id` **aus dem Laufdatensatz**, nicht aus der Datei
3. Upsert auf `tenant_knowledge`
4. Ergebnis am Lauf protokollieren: welche keys übernommen, welche verworfen und
   warum. Sonst verschwindet ein verworfener Eintrag stillschweigend.

Erlaubte keys:

```
overview, brand_identity, brand_visual, brand_products, brand_audience,
brand_social, brand_website, brand_campaigns, brand_competitors,
brand_strategy, brand_claims, brand_content_bank
```

---

## Einmalige Einrichtung

### 1. Anmelden am MoonAi-Workspace

```bash
ant auth login --profile moonai --workspace-id wrkspc_019KKnEG6rCpwp7MKmbpg58C
ant profile activate moonai
```

Prüfen: `ant auth status` muss `moonai` als aktives Profil und die Workspace-ID
oben zeigen.

### 2. Environment anlegen

Netzwerk bewusst eingeschränkt. Seit Weg C braucht der Agent **drei** Hosts —
Supabase ist entfallen.

```bash
cat > /tmp/env.yaml <<'YAML'
name: kana-agents
config:
  type: cloud
  networking:
    type: limited
    allow_package_managers: false
    allowed_hosts:
      - api.apify.com
      - www.sinsnlashes.com
      - www.facebook.com
YAML
ENV_ID=$(ant beta:environments create < /tmp/env.yaml --transform id -r)
echo "$ENV_ID"
```

Hinweis: Die Ziel-Hosts der Apify-Scrapes (TikTok, Instagram, Trustpilot …)
müssen **nicht** in `allowed_hosts` — die ruft Apify auf seinen eigenen Servern
auf, nicht der Container.

⚠️ **Beim Anlegen über die Console** ist `allowed_hosts` ein einzelnes
Eingabefeld, keine YAML-Liste. Verifiziert am 15.08.2026: **mehrere Hosts durch
Komma trennen.** Zeilenumbrüche funktionieren nicht — ein zeilenweise
eingefügter Block landet komplett als Eintrag 0, und die Console meldet
`allowed_hosts[0] is not a valid hostname or *.domain wildcard`.

Je Host nur der nackte Hostname — ohne das führende `- ` aus dem YAML oben,
ohne `https://`, ohne Slash am Ende. Achte beim Einfügen aus einem gerenderten
Markdown-Dokument darauf, dass Hostnamen nicht als Link mitkommen.

Zum Kopieren in das Console-Feld:

    api.apify.com, www.sinsnlashes.com, www.facebook.com

### 3. Vault mit dem Secret anlegen

Seit Weg C nur noch **ein** Credential. Es wird nur in den **Header** eingesetzt,
nicht in den Body — das ist die engere Einstellung und reicht für die Apify-API.

```bash
VAULT_ID=$(ant beta:vaults create --display-name "KANA Agents" --transform id -r)
echo "$VAULT_ID"
```

```bash
ant beta:vaults:credentials create --vault-id "$VAULT_ID" \
  --display-name "Apify API Token" \
  --auth '{
    type: environment_variable,
    secret_name: APIFY_API_TOKEN,
    secret_value: "<APIFY_API_TOKEN — FEHLT NOCH, siehe unten>",
    networking: { type: limited, allowed_hosts: ["api.apify.com"] },
    injection_location: { header: true }
  }'
```

> ⚠️ **Kein Supabase-Credential mehr anlegen.** Falls aus dem Versuch vom 15.08.
> noch eines existiert, löschen — und den `SUPABASE_SERVICE_ROLE_KEY` bei Supabase
> **rotieren**, weil er in einem Vault gelegen hat.

### 4. Agent anlegen

```bash
AGENT_ID=$(ant beta:agents create < agents/brand-expert.agent.yaml --transform id -r)
echo "$AGENT_ID"
```

IDs (`ENV_ID`, `VAULT_ID`, `AGENT_ID`) danach in `.env.local` ablegen.
Spätere Änderungen am YAML per `update`, nicht per `create`:

```bash
ant beta:agents update --agent-id "$AGENT_ID" --version <N> < agents/brand-expert.agent.yaml
```

---

## Session starten

Der Modus wird **nicht** als User-Nachricht übergeben, sondern als
`agent_with_overrides` — der modusspezifische System-Prompt wird an den
Basis-Prompt gehängt. Das ist näher am alten Verhalten, wo jeder Modus einen
eigenen vollständigen System-Prompt hatte.

```
system = <system aus brand-expert.agent.yaml> + "\n\n" + <modes/<MODUS>.md>
```

Modi: `brand-setup`, `weekly-update`, `brand-check`, `brand-update`.

Bei `brand-check` und `brand-update` kommt der zu prüfende Inhalt als erste
User-Nachricht (`initial_events`), nicht mehr in den Prompt interpoliert.

Zusätzlich muss die Session die Wissensbasis mitbekommen — siehe Backend-Vertrag
oben. Ohne sie arbeiten alle vier Modi im Blindflug.

### `weekly-update` als Scheduled Deployment

⚠️ **Vorsicht — das kollidiert mit der Kontingentprüfung.** Ein Deployment startet
den Lauf in der Console, also **an unserem Backend vorbei**. Damit greift weder die
Kontingentprüfung noch die Verbrauchserfassung, und die Wissensbasis wird nicht in
den Container gelegt. Für den Machbarkeits-Test mit einem einzigen Mandanten
vertretbar; für den Produktivbetrieb ist die eigene Zeitsteuerung
(`app/api/cron/`) der vorgesehene Weg.

Falls trotzdem gebraucht:

⚠️ **`ant` 1.9.1 kennt `beta:deployments` noch nicht** (geprüft: fehlt in
`ant --help`). Bis die CLI nachzieht, per REST anlegen:

```bash
curl -s -X POST https://api.anthropic.com/v1/deployments \
  -H "Authorization: Bearer $(ant auth print-credentials --access-token)" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01,oauth-2025-04-20" \
  -H "content-type: application/json" \
  -d '{
    "name": "Brand Expert Weekly",
    "agent": "'"$AGENT_ID"'",
    "environment_id": "'"$ENV_ID"'",
    "vault_ids": ["'"$VAULT_ID"'"],
    "initial_events": [
      {"type": "user.message", "content": [{"type": "text", "text": "Führe den Weekly Update durch."}]}
    ],
    "schedule": {"type": "cron", "expression": "0 7 * * 1", "timezone": "Europe/Berlin"}
  }'
```

Der `oauth-2025-04-20`-Header ist nötig, weil hier mit einem Bearer-Token aus
dem `ant`-Profil authentifiziert wird und nicht mit `x-api-key`.

Achtung: Ein Deployment kopiert den Modus **nicht** — der Weekly-Modus muss
über den Agent oder einen Override gesetzt sein. Sauberste Lösung: einen
zweiten Agent `Brand Expert Weekly` mit dem Weekly-Prompt im `system` anlegen
und das Deployment darauf zeigen lassen.

---

## Offene Punkte

- **`APIFY_API_TOKEN` fehlt.** Weder in `.env.local` noch sonst im Projekt.
  Ohne ihn sind `brand-setup` und `weekly-update` nicht lauffähig —
  `brand-check` und `brand-update` laufen auch ohne.
- **`GEMINI_API_KEY` fehlt** — blockiert später den Research Agent.
- **Backend-Vertrag ist noch nicht gebaut.** Ohne ihn liest der Agent keine
  Wissensbasis und nichts wird zurückgeschrieben. Das ist der nächste Schritt.
- **Modi sind noch SNL-spezifisch.** `brand-setup` und `weekly-update` enthalten
  feste URLs. Für die Mandantenfähigkeit müssen Kanäle und Wettbewerber aus
  `brand_social` und `brand_competitors` kommen. Der Basis-Prompt ist bereits
  mandantenneutral.
- **RLS auf den Wissenstabellen prüfen.** `brand_knowledge`,
  `strategist_knowledge`, `analyst_knowledge`, `analyst_results` und
  `analyst_breakdowns` haben in `docs/supabase-schema.sql` kein
  `ENABLE ROW LEVEL SECURITY`. Ohne RLS sind sie mit dem öffentlichen
  Publishable Key lesbar. Das ist unabhängig von dieser Migration, aber es
  betrifft dieselben Daten.
- Modell bleibt vorerst `claude-sonnet-4-6` wie im Altcode. Ein Wechsel auf
  `claude-opus-5` oder `claude-sonnet-5` ist eine eigene Entscheidung nach der
  Migration, nicht Teil davon.
- Langfristig wird die Wissensbasis ein **Memory Store**. Die 50.000-Zeichen-
  Schwelle im Backend markiert den Umstellungszeitpunkt.
