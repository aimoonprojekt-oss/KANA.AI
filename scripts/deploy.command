#!/bin/bash
cd ~/Desktop/agent-platform

echo "Setze Git-Email..."
git config user.email "kaileonbecker@gmail.com"
git config user.name "KLB2104"

echo "Staging..."
git add \
  lib/supabase.ts \
  app/page.tsx \
  app/dashboard/page.tsx \
  app/components/LandingPage.tsx \
  app/components/PortalDashboard.tsx \
  app/api/chat/route.ts \
  app/api/admin/sync-agents/route.ts \
  app/api/webhooks/stripe/route.ts \
  types/lucide-react.d.ts \
  docs/ \
  scripts/

echo "Commit..."
git commit -m "Refactor: agent_access1 statt agent_access

- Alle Zugriffslogik auf agent_access1 umgestellt
- Organisations-basiertes Modell: User → Organization → Agent
- getOrCreateOrganization() erstellt org automatisch beim ersten Zugang
- checkAgentAccess/getUserAccessedAgents/grantAgentAccess komplett neu
- getUserUsageStats: Agent-Namen aus agents-Tabelle statt agent_access
- Stripe-Webhook kompatibel mit neuer grantAgentAccess-Signatur
- Sync-Route + upsertAgent: robuster, mit Fehlerdetails"

echo "Push..."
git push origin main

echo ""
echo "Fertig! Vercel deployt automatisch."
echo "https://kanaai-49uy.vercel.app"
echo ""
read -p "Fenster schliessen? [Enter]"
