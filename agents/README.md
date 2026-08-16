# Agents als Managed Agents

Migration der Agents aus `lib/agents/*.ts` und `app/api/*/run/route.ts` in den
MoonAi-Workspace der Claude Console.

**Der alte Pfad bleibt unangetastet.** Die TypeScript-Agents laufen weiter, bis der
Console-Pfad nachweislich dasselbe tut. Dieses Verzeichnis ist additiv.

Ziel-Workspace: `wrkspc_019KKnEG6rCpwp7MKmbpg58C`

## Stand

| Agent | Quelle | YAML | Angelegt |
|---|---|---|---|
| Brand Expert | `lib/agents/brandExpert.ts` + `api/brand-expert/run` | ✅ | ⬜ |
| Creative Analyst | `lib/agents/creativeAnalyst.ts` + `api/creative-analyst/run` | ⬜ | ⬜ |
| Creative Strategist | `lib/agents/creativeStrategist.ts` + `api/creative-strategist/run` | ⬜ | ⬜ |
| Research Agent | `api/research/run/route.ts` (Logik in der Route) | ⬜ | ⬜ |

## Architektur-Entscheidung: Weg B

Die Datenbank- und Scraping-Tools werden **nicht** als Custom Tools nachgebaut.
Stattdessen ruft der Agent Supabase und Apify selbst per `bash`/`curl` aus der
Sandbox auf. Die Secrets liegen als `environment_variable`-Credentials in einem
Vault: im Container steht nur ein Platzhalter, der echte Wert wird erst beim
ausgehenden Request eingesetzt und ist für Code in der Sandbox nie lesbar.

Damit läuft der Agent vollständig in der Console — das Next.js-Backend ist nicht
mehr im Pfad.

### Was das je Tool bedeutet

| Alt (TypeScript-Tool) | Neu |
|---|---|
| `read_brand_knowledge` / `read_all_knowledge` | `curl` GET auf Supabase REST |
| `write_brand_knowledge` | `curl` POST mit `Prefer: resolution=merge-duplicates` |
| `fetch_website` | eingebautes `web_fetch` |
| `scrape_meta_ads` | `curl` POST auf Apify Actor `curious_coder~facebook-ads-library-scraper` |
| `scrape_web` | `curl` POST auf Apify Actor `apify~rag-web-browser` |

## Einmalige Einrichtung

### 1. Anmelden am MoonAi-Workspace

```bash
ant auth login --profile moonai --workspace-id wrkspc_019KKnEG6rCpwp7MKmbpg58C
ant profile activate moonai
```

Prüfen: `ant auth status` muss `moonai` als aktives Profil und die Workspace-ID
oben zeigen.

### 2. Environment anlegen

Netzwerk bewusst eingeschränkt — der Agent braucht nur vier Hosts.

```bash
cat > /tmp/env.yaml <<'YAML'
name: kana-agents
config:
  type: cloud
  networking:
    type: limited
    allow_package_managers: false
    allowed_hosts:
      - koffbdobhehdcthsrtyh.supabase.co
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

    koffbdobhehdcthsrtyh.supabase.co, api.apify.com, www.sinsnlashes.com, www.facebook.com

### 3. Vault mit den Secrets anlegen

Zwei Credentials. Beide werden nur in den **Header** eingesetzt, nicht in den
Body — das ist die engere Einstellung und reicht für beide APIs.

```bash
VAULT_ID=$(ant beta:vaults create --display-name "KANA Agents" --transform id -r)
echo "$VAULT_ID"
```

```bash
ant beta:vaults:credentials create --vault-id "$VAULT_ID" \
  --display-name "Supabase Service Role" \
  --auth '{
    type: environment_variable,
    secret_name: SUPABASE_SERVICE_ROLE_KEY,
    secret_value: "<SUPABASE_SERVICE_ROLE_KEY aus .env.local>",
    networking: { type: limited, allowed_hosts: ["koffbdobhehdcthsrtyh.supabase.co"] },
    injection_location: { header: true }
  }'
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

### `weekly-update` als Scheduled Deployment

Der Wochenlauf braucht keinen eigenen Scheduler mehr. Ein Deployment feuert
selbst und legt pro Lauf eine Session an.

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

## Offene Punkte

- **`APIFY_API_TOKEN` fehlt.** Weder in `.env.local` noch sonst im Projekt.
  Ohne ihn sind `brand-setup` und `weekly-update` nicht lauffähig —
  `brand-check` und `brand-update` laufen auch ohne.
- **`GEMINI_API_KEY` fehlt** — blockiert später den Research Agent.
- Modell bleibt vorerst `claude-sonnet-4-6` wie im Altcode. Ein Wechsel auf
  `claude-opus-5` oder `claude-sonnet-5` ist eine eigene Entscheidung nach der
  Migration, nicht Teil davon.
- Die `brand_knowledge`-Tabelle wäre langfristig ein **Memory Store** statt
  einer Supabase-Tabelle. Bewusst noch nicht angefasst.
