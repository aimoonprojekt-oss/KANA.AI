# 🚀 Agent Platform — Schritt-für-Schritt Deployment

## SCHRITT 1: Voraussetzungen installieren

### Node.js installieren
1. Gehe zu https://nodejs.org
2. Lade "LTS" (Long Term Support) herunter
3. Installieren und Terminal neu starten
4. Prüfen: `node --version` → sollte "v20..." zeigen

### GitHub Account erstellen
1. Gehe zu https://github.com
2. "Sign up" → kostenlosen Account erstellen

---

## SCHRITT 2: Accounts bei allen Plattformen erstellen

| Plattform | URL | Was tun |
|-----------|-----|---------|
| **Clerk** | https://clerk.com | "Get started" → App erstellen → API Keys kopieren |
| **Supabase** | https://supabase.com | "Start your project" → Projekt erstellen → API Keys kopieren |
| **Vercel** | https://vercel.com | Mit GitHub einloggen |
| **Stripe** | https://stripe.com | Account erstellen → Test-Modus lassen |
| **Anthropic** | https://platform.claude.com | API Key erstellen |

---

## SCHRITT 3: Projekt auf deinem Computer einrichten

```bash
# Terminal öffnen, dann:

# 1. Projekt-Ordner öffnen (wo du die Dateien entpackt hast)
cd agent-platform

# 2. Abhängigkeiten installieren
npm install

# 3. .env.local erstellen
cp .env.local.example .env.local
```

Dann `.env.local` öffnen und alle Keys eintragen (von Schritt 2).

---

## SCHRITT 4: Datenbank einrichten (Supabase)

1. Gehe zu https://supabase.com → dein Projekt
2. Klicke links auf **"SQL Editor"**
3. Klicke **"New Query"**
4. Kopiere den Inhalt von `supabase-schema.sql` und füge ihn ein
5. Klicke **"Run"** → "Success" sollte erscheinen

---

## SCHRITT 5: Deine Agents eintragen

Öffne `lib/agents.ts` und trage deine Anthropic Agent IDs ein:

```typescript
// Deine Agent IDs findest du hier:
// platform.claude.com → Managed Agents → Dein Agent → "agent_id" kopieren

{
  id: "agt_HIER_DEINE_ECHTE_ID",   // ← Das ist der wichtigste Wert
  name: "Sales Agent",
  ...
}
```

---

## SCHRITT 6: Lokal testen

```bash
npm run dev
```

Browser öffnen: http://localhost:3000

Du solltest die Login-Seite sehen. ✅

### Ersten Testzugang manuell freischalten:
1. Einloggen mit deinem Clerk-Account
2. Deine Clerk User ID notieren (in Clerk Dashboard → Users)
3. In Supabase SQL Editor ausführen:

```sql
INSERT INTO agent_access (user_id, agent_id, agent_name, agent_description)
VALUES (
  'user_DEINE_CLERK_ID',
  'agt_DEINE_AGENT_ID',
  'Sales Agent',
  'Mein erster Agent'
);
```

4. Dashboard neu laden → Agent sollte erscheinen ✅

---

## SCHRITT 7: Auf Vercel deployen

```bash
# 1. Git Repository initialisieren
git init
git add .
git commit -m "Initial commit"

# 2. GitHub Repository erstellen (auf github.com)
# 3. Code hochladen:
git remote add origin https://github.com/DEIN-USERNAME/agent-platform.git
git push -u origin main
```

**In Vercel:**
1. https://vercel.com → "Add New Project"
2. GitHub Repository auswählen
3. **"Environment Variables"** — alle Keys aus `.env.local` eintragen!
4. "Deploy" klicken

Nach ~2 Minuten ist die Website live unter `https://agent-platform.vercel.app` ✅

---

## SCHRITT 8: Stripe Webhook einrichten

1. https://dashboard.stripe.com → Developers → Webhooks
2. "Add endpoint" → URL: `https://DEINE-DOMAIN.vercel.app/api/webhooks/stripe`
3. Event auswählen: `checkout.session.completed`
4. "Add endpoint" → Webhook Secret kopieren
5. In Vercel Environment Variables: `STRIPE_WEBHOOK_SECRET` eintragen
6. Vercel neu deployen (Settings → Deployments → Redeploy)

---

## ✅ Fertig! Deine Plattform läuft.

**Testen:**
- Kunde kauft Agent über Stripe Checkout → Zugang wird automatisch freigeschaltet
- Kunde loggt sich ein → sieht seine Agents → kann chatten

**Nächste Schritte:**
- Stripe Checkout-Links für jeden Agent erstellen
- Design anpassen (Farben, Logo in app/globals.css)
- Eigene Domain in Vercel eintragen
