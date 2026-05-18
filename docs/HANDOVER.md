# KANA AI — Handover-Protokoll
**Stand: Mai 2026 | Projekt: `/Users/kai/Desktop/agent-platform`**

---

## Was ist KANA AI?

Eine SaaS-Plattform zum Verkauf von Anthropic Managed Agents. Kunden kaufen Agents per Stripe-Abo, bekommen beim Kauf automatisch ihre eigene persönliche Kopie des Agents in der Anthropic Console, und können dann über ein Dashboard mit ihrem Agent chatten.

**Live-URL:** https://kanaai-49uy.vercel.app  
**GitHub:** https://github.com/KLB2104/KANAAI  
**Vercel:** Projekt "KANAAI", auto-deploy von `main`

---

## Tech-Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Clerk (`auth()`, `currentUser()`) |
| Datenbank | Supabase (service role admin client) |
| AI Agents | Anthropic Managed Agents API (Beta SDK) |
| Payments | Stripe (Checkout + Webhooks) |
| Deployment | Vercel (Node runtime, maxDuration 300s) |
| Icons | lucide-react (manuelle Types in `types/lucide-react.d.ts`) |

---

## Architektur-Kernkonzept: Per-Customer Agent Isolation

Jeder Kunde hat seine eigene Kopie des Master-Agents in der Anthropic Console:

```
Master-Agent (agent_xxx)  ← nur KANA AI sieht/editiert diesen
       │
       ▼ beim Kauf: beta.agents.create() kopiert Config
Kundenkopie (agent_yyy)  ← in agent_access1.customer_anthropic_agent_id gespeichert
       │
       ▼ im Chat: sessions.create({ agent: "agent_yyy" })
Customer-Session
```

**Warum:** Nutzungskosten pro Kunde sind in der Anthropic Console separat sichtbar. Der Kunde kann den Systemprompt nicht sehen/ändern — er gibt nur Tasks und Dateien rein.

---

## Supabase-Schema (Tabellen die genutzt werden)

### `agents` — Master-Agent-Katalog
```sql
id                  uuid PK
anthropic_agent_id  text UNIQUE  -- z.B. "agent_01G2..."
environment_id      text
name                text
slug                text
description         text
category            text
thumbnail_url       text
price_eur           numeric
published           boolean      -- nur published=true erscheint auf der Website
featured            boolean
stripe_price_id     text         -- Stripe price_xxx ID (für Checkout)
created_at          timestamptz
```

### `organizations` — 1 User = 1 Organisation
```sql
id          uuid PK
name        text
user_id     text UNIQUE  -- Clerk user_id
created_at  timestamptz
```

### `agent_access1` — Welcher Kunde hat welchen Agent gekauft
```sql
id                           uuid PK
organization_id              uuid → organizations.id
agent_id                     uuid → agents.id  (Master-Agent UUID)
customer_anthropic_agent_id  text              (Kundenkopie agent_id)
active                       boolean
purchased_at                 timestamptz
```

### `sessions` — Chat-Sessions
```sql
id                    uuid PK
user_id               text    -- Clerk user_id
agent_id              text    -- anthropic_agent_id
anthropic_session_id  text
created_at            timestamptz
last_message_at       timestamptz
```

### `runs` — Einzelne Task-Ausführungen
```sql
id               uuid PK
session_id       uuid
status           text  -- created/running/completed/failed
input_prompt     text
output_summary   text
started_at       timestamptz
completed_at     timestamptz
created_at       timestamptz
```

### SQL-Constraints (in Supabase SQL Editor ausführen falls noch nicht gemacht)
```sql
ALTER TABLE public.agents
  ADD CONSTRAINT agents_anthropic_agent_id_unique
  UNIQUE (anthropic_agent_id);

ALTER TABLE public.agent_access1
  ADD CONSTRAINT agent_access1_org_agent_unique
  UNIQUE (organization_id, agent_id);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS user_id text UNIQUE;
```

---

## Dateistruktur

```
app/
  page.tsx                          Landing Page (Server, holt published agents aus DB)
  dashboard/page.tsx                Dashboard (Server, holt userAgents + lockedAgents + usage)
  chat/[agentId]/page.tsx           Chat-Interface
  layout.tsx                        ClerkProvider wrapper
  sign-in/ sign-up/                 Clerk auth pages
  components/
    LandingPage.tsx                 Client Component — zeigt agents aus DB mit Preisen
    PortalDashboard.tsx             Client Component — Dashboard mit Buy/Start-Buttons
  api/
    chat/route.ts                   SSE-Stream mit Anthropic Managed Agents
    checkout/route.ts               Stripe Checkout Session erstellen
    webhooks/stripe/route.ts        Nach Kauf: Agent-Kopie erstellen + Zugang freischalten
    admin/
      sync-agents/route.ts          Anthropic Console → Supabase sync (POST)
      grant-access/route.ts         Admin: Zugang ohne Zahlung freischalten (POST)
      test-agent-api/route.ts       Testet retrieve + create + delete (GET)
lib/
  supabase.ts                       Alle DB-Funktionen + Typen
types/
  lucide-react.d.ts                 Manuelle Type-Declarations für lucide-react
docs/
  HANDOVER.md                       Diese Datei
  ANLEITUNG.md                      Setup-Anleitung
  supabase-schema.sql               Vollständiges DB-Schema
```

---

## Wichtige Funktionen in `lib/supabase.ts`

| Funktion | Was sie tut |
|---|---|
| `getOrCreateOrganization(userId)` | Org für Clerk-User finden oder anlegen |
| `checkAgentAccess(userId, anthropicAgentId)` | Hat User Zugang? (via org → agent_access1) |
| `getUserAccessedAgents(userId)` | Alle Agents des Users (für Dashboard) |
| `getLockedAgentsForUser(userId)` | Published Agents die noch nicht gekauft wurden |
| `getPublishedAgents()` | Alle published Agents (für Landing Page) |
| `getDBAgentById(anthropicAgentId)` | Agent per Anthropic-ID laden |
| `upsertAgent(...)` | Agent in DB schreiben (select-then-insert/update) |
| `grantAgentAccess(userId, masterId, customerCopyId)` | Zugang in agent_access1 eintragen |
| `getCustomerAgentId(userId, masterId)` | Kunden-spezifische Anthropic Agent-ID holen |
| `saveSession / createRun / completeRun` | Session + Run Tracking |
| `getUserUsageStats(userId)` | Nutzungsübersicht für Verlauf-Tab |

---

## Wichtige API-Endpunkte

### `POST /api/chat`
Body: `{ agentId, message, sessionId? }`  
→ SSE-Stream, gibt `data: { text }` Chunks + `data: [DONE]` zurück  
→ Nutzt `customer_anthropic_agent_id` aus `agent_access1`, fällt auf Master zurück  
Headers zurück: `X-Session-Id`, `X-Agent-Name`

### `POST /api/checkout`
Body: `{ anthropicAgentId }`  
→ Erstellt Stripe Checkout Session, gibt `{ url }` zurück  
→ Benötigt `stripe_price_id` in `agents` Tabelle

### `POST /api/webhooks/stripe`
Event: `checkout.session.completed`  
Ablauf:
1. Liest `clerk_user_id` + `anthropic_agent_id` aus Session-Metadata
2. Lädt Master-Config via `beta.agents.retrieve(masterAgentId)`
3. Erstellt Kundenkopie via `beta.agents.create({ name, model, system, tools, skills, mcp_servers })`
4. Schreibt Kundenkopie-ID via `grantAgentAccess(userId, masterId, customerAgent.id)`

### `POST /api/admin/sync-agents`
→ Holt alle Agents aus Anthropic Console, schreibt sie in `agents`-Tabelle  
→ **Überspringt automatisch Kundenkopien** (Erkennungsmuster: ` — user_` im Namen)  
→ Neue Agents landen mit `published: false` — manuell in Supabase auf `true` setzen

### `POST /api/admin/grant-access`
Body: `{ anthropicAgentId }`  
→ Schaltet Zugang für den eingeloggten User frei (ohne Zahlung, für Tests)

---

## Anthropic Beta SDK — wichtige Erkenntnisse

```typescript
const beta = (anthropic as any).beta;

// Sessions
const session = await beta.sessions.create({ agent: agentId, environment_id, title });
const stream  = await beta.sessions.events.stream(sessionId);
await beta.sessions.events.send(sessionId, { events: [{ type: "user.message", content: [...] }] });

// Agents
const agent = await beta.agents.retrieve(agentId);
const copy  = await beta.agents.create({
  name, model,        // model ist ein Objekt: { id: "claude-sonnet-4-6", ... }
  system, description,
  tools, skills, mcp_servers,
  // KEIN environment_id! → 400 "Extra inputs are not permitted"
});
// beta.agents.delete() existiert NICHT im SDK (manuell in Console löschen)
```

Event-Types im Stream:
- `agent.message.delta` → `event.delta.text` (Streaming)
- `agent.message` → `event.content[].text` (Volltext)
- `agent.tool_use` → `event.name`
- `session.status_idle` → Agent fertig, Stream schließen

---

## Vercel Environment Variables (alle erforderlich)

```
ANTHROPIC_API_KEY
ANTHROPIC_ENVIRONMENT_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_BASE_URL=https://kanaai-49uy.vercel.app
```

---

## Aktueller Stand & Was noch fehlt

### Fertig ✅
- Landing Page zeigt published Agents dynamisch aus DB mit Preisen
- Dashboard zeigt gekaufte Agents + gesperrte Agents zum Kauf
- Chat-Interface mit SSE-Streaming läuft
- Admin: Sync-Button (Anthropic Console → Supabase), Grant-Access-Button
- Stripe Checkout-Flow (Code fertig)
- Webhook: erstellt Kundenkopie + schaltet Zugang frei (Code fertig)
- Per-Customer Agent Isolation (jeder Kunde hat eigene Anthropic Agent-ID)
- Buy-Button im Dashboard ist verdrahtet → ruft `/api/checkout` auf → redirect zu Stripe
- Sync filtert Kundenkopien raus (Muster: ` — user_` im Namen)
- Nutzungsübersicht / Verlauf-Tab im Dashboard

### Noch offen / nächste Schritte 🔲

**Stripe aktivieren (auf Eis gelegt):**
- Stripe-Produkt + Preis anlegen → `price_xxx` ID in `agents.stripe_price_id` in Supabase eintragen
- Stripe Webhook-Endpunkt registrieren: `https://kanaai-49uy.vercel.app/api/webhooks/stripe`
- Event: `checkout.session.completed`
- `STRIPE_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` in Vercel eintragen
- `NEXT_PUBLIC_BASE_URL` in Vercel eintragen

**Supabase (falls noch nicht gemacht):**
- Die drei Constraints aus dem SQL-Block oben ausführen
- Gekaufte Kundenkopien die durch Sync reingekommen sind: `published = false` setzen oder löschen

**Features die noch nicht existieren:**
- Datei-Upload: Kunden sollen Dateien/Kontext an den Agent übergeben können (`files` + `outputs` Tabelle ist im Schema bereits vorhanden)
- Abo-Kündigung: `customer.subscription.deleted` Webhook → `active = false` in `agent_access1`
- Admin-Panel: Agents direkt in der App verwalten (aktuell nur über Supabase Table Editor)
- Multi-Agent-Unterstützung: Kunde kauft mehrere Agents
- Eigene Domain

---

## Bekannte Eigenheiten / Fallstricke

- **git push**: Immer direkt im Terminal auf dem Mac ausführen — nie aus der Sandbox. Keine `git config user.email` Zeile nötig, lokales Git ist konfiguriert.
- **Vercel Deploy**: Wenn nach `git push` nichts deployed wird → Vercel Dashboard → Deployments prüfen auf Build-Fehler. Ggf. Settings → Git → Reconnect.
- **Anthropic SDK**: `(anthropic as any).beta` — die Beta-Typen sind nicht im offiziellen SDK-TypeScript enthalten.
- **upsertAgent**: Nutzt select-then-insert/update statt `.upsert()` wegen UNIQUE-Constraint-Problemen.
- **Kundenkopien im Sync**: Werden anhand des Namensmusters ` — user_` erkannt und übersprungen.
- **agents.delete()**: Nicht im SDK — manuell in der Anthropic Console löschen.
