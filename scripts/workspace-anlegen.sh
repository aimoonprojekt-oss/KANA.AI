#!/usr/bin/env bash
# Legt einen Kunden-Workspace an. Braucht ANTHROPIC_ADMIN_KEY (sk-ant-admin...).
# Aufruf: workspace-anlegen.sh "kunde-snl"
#
# API-Schluessel und Ausgabengrenze lassen sich NICHT per API setzen — das
# bleibt Handarbeit in der Console. Siehe claude/17_Workspace-Onboarding.
set -euo pipefail

NAME="${1:?Workspace-Name fehlt}"
: "${ANTHROPIC_ADMIN_KEY:?ANTHROPIC_ADMIN_KEY fehlt}"

ANZAHL=$(curl -s https://api.anthropic.com/v1/organizations/workspaces \
  -H "x-api-key: $ANTHROPIC_ADMIN_KEY" \
  -H "anthropic-version: 2023-06-01" \
  | jq '[.data[] | select(.archived_at == null)] | length')

echo "Aktive Workspaces: $ANZAHL von 100"
[ "$ANZAHL" -ge 100 ] && { echo "ABBRUCH: 100 Workspaces erreicht."; exit 1; }
[ "$ANZAHL" -ge 80 ]  && echo "WARNUNG: Grenze rueckt naeher — Modell pruefen (claude/16_..., Abschnitt 5)."

curl -s -X POST https://api.anthropic.com/v1/organizations/workspaces \
  -H "x-api-key: $ANTHROPIC_ADMIN_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg n "$NAME" '{name:$n}')" \
  | jq -r '"\(.id)  \(.name)"'

cat <<'HINWEIS'

Weiter von Hand in der Console:
  1. API-Schluessel anlegen -> Passwortmanager, Referenz nach tenants.anthropic_api_key_ref
  2. Spend limits setzen (Notbremse, NICHT das Kontingent)
Danach: scripts/kunde-einrichten.sh
HINWEIS
