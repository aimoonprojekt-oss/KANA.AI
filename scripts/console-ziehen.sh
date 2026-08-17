#!/usr/bin/env bash
# Holt die Agentendefinitionen aus dem AKTIVEN Workspace ins Repo.
#
# Zweck 1 — Sicherung: Console-Definitionen sind nicht durch Git geschuetzt.
#   Betrifft besonders Support- und Widget-Agent, deren Definitionen bisher
#   NUR in der Console liegen (siehe claude/06_..., Abschnitt 5).
# Zweck 2 — Drift erkennen: Nach dem Lauf `git diff`. Zeigt der Diff etwas,
#   hat jemand direkt in der Oberflaeche gearbeitet.
#
# Gehoert zusaetzlich in die naechtliche CI.
#
# Aufruf: console-ziehen.sh [zielordner]      (Standard: agents/_console)
set -euo pipefail

ZIEL="${1:-agents/_console}"
mkdir -p "$ZIEL"

command -v ant >/dev/null || { echo "ant nicht gefunden" >&2; exit 1; }

ant auth status >&2

ant beta:agents list -r | jq -c '.[]?' | while read -r A; do
  ID=$(echo "$A"   | jq -r '.id')
  NAME=$(echo "$A" | jq -r '.name')
  SLUG=$(echo "$NAME" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/ä/ae/g; s/ö/oe/g; s/ü/ue/g; s/ß/ss/g' \
    | sed -e 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')

  mkdir -p "$ZIEL/$SLUG"
  ant beta:agents get --agent-id "$ID" -r | yq -y '.' > "$ZIEL/$SLUG/agent.yaml"
  printf 'agent_id: %s\nname: %s\ngezogen_am: %s\n' \
    "$ID" "$NAME" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ZIEL/$SLUG/.console"

  echo "  gezogen: $NAME -> $ZIEL/$SLUG/agent.yaml" >&2
done

echo "Fertig. Jetzt: git diff $ZIEL" >&2
