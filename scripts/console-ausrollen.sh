#!/usr/bin/env bash
# Rollt alle Agentendefinitionen aus dem Repo in den AKTIVEN Workspace aus.
# Legt an, was fehlt; aktualisiert, was es schon gibt. Nie umgekehrt.
#
# Das Repo ist die Quelle, die Console ist das Abbild. Es gibt genau einen
# schreibenden Weg — diesen hier, aus main, nach Freigabe.
#
# Aufruf: console-ausrollen.sh [MANDANT]
# Ausgabe auf stdout: JSON { "<ordner>": "<agent_id>", ... }
set -euo pipefail

MANDANT="${1:-kana}"
ERGEBNIS="{}"

command -v ant >/dev/null || { echo "ant nicht gefunden — brew install anthropics/tap/ant" >&2; exit 1; }
command -v yq  >/dev/null || { echo "yq nicht gefunden" >&2; exit 1; }

echo "Aktives Profil:" >&2
ant auth status >&2

BESTAND=$(ant beta:agents list --transform 'map({(.name): {id, version}}) | add' -r 2>/dev/null || echo '{}')

for YAML in agents/*/agent.yaml; do
  [ -e "$YAML" ] || continue
  ORDNER=$(dirname "$YAML")
  NAME=$(yq -r '.name' "$YAML")

  # Mandant als Metadatum mitgeben — hilfreich beim Suchen, NICHT zur Trennung.
  TMP=$(mktemp)
  yq -y --arg m "$MANDANT" '.metadata.tenant = $m' "$YAML" > "$TMP"

  VORHANDEN=$(echo "$BESTAND" | jq -r --arg n "$NAME" '.[$n].id // empty')

  if [ -n "$VORHANDEN" ]; then
    VERSION=$(echo "$BESTAND" | jq -r --arg n "$NAME" '.[$n].version')
    ID=$(ant beta:agents update --agent-id "$VORHANDEN" --version "$VERSION" < "$TMP" --transform id -r)
    echo "  aktualisiert: $NAME -> $ID" >&2
  else
    ID=$(ant beta:agents create < "$TMP" --transform id -r)
    echo "  angelegt:     $NAME -> $ID" >&2
  fi
  rm -f "$TMP"

  ERGEBNIS=$(echo "$ERGEBNIS" | jq --arg k "$(basename "$ORDNER")" --arg v "$ID" '.[$k] = $v')
done

echo "$ERGEBNIS"
