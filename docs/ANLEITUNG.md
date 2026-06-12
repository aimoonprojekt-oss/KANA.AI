# KANA.AI — Setup-Anleitung

## Voraussetzungen

- Node.js 20 LTS
- GitHub Account
- Accounts bei: Clerk, Supabase, Railway, Stripe, Anthropic

---

## Schritt 1: Accounts & API Keys

| Plattform | URL | Was holen |
|---|---|---|
| **Clerk** | https://clerk.com | Publishable Key + Secret Key |
| **Supabase** | https://supabase.com | Project URL + Service Role Key + Anon Key |
| **Railway** | https://railway.app | Projekt erstellen, GitHub verbinden |
| **Stripe** | https://stripe.com | Secret Key + Webhook Secret |
| **Anthropic** | https://platform.claude.com | API Key |

---

## Schritt 2: Datenbank einrichten

1. Supabase → SQL Editor → New Query
2. Inhalt von `docs/supabase-schema.sql` einfügen → Run
3. Für den Support-Widget: `docs/widget-configs-schema.sql` ebenfalls ausführen

---

## Schritt 3: Lokal einrichten

```bash
npm install
cp .env.local.example .env.local
# .env.local öffnen und alle Keys eintragen
npm run dev
```

---

## Schritt 4: Auf Railway deployen

Railway deployt automatisch bei jedem `git push origin main`.

1. Railway → New Project → Deploy from GitHub Repo
2. Environment Variables in Railway eintragen (alle aus `.env.local.example`)
3. `git push origin main` → Railway baut und deployed automatisch

**Stripe Webhook:**
- URL: `https://DEINE-RAILWAY-DOMAIN/api/webhooks/stripe`
- Event: `checkout.session.completed`
- Webhook Secret in Railway ENV eintragen

---

## Schritt 5: Admin-Zugang einrichten

In Railway Environment Variables:
```
ADMIN_USER_IDS=user_DEINE_CLERK_ID
```

Mehrere Admins: kommagetrennt `user_ID1,user_ID2`

---

## Brand Expert Agent

Die Wissensbasis für Sins 'n Lashes liegt in Supabase (`brand_knowledge` Tabelle).
Neu befüllen mit:
```bash
node seed_supabase.js   # aus dem "Brand experte railway" Ordner
```
