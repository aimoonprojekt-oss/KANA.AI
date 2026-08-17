#!/usr/bin/env bash
# Prueft empirisch, ob Agenten und Environments workspace-gebunden sind.
# In KEINER Dokumentationsseite steht die Antwort — sie wird gemessen.
# Aufruf: console-test-bindung.sh <WORKSPACE_A> <WORKSPACE_B>
# Ergebnis gehoert nach claude/09_Console-Kompendium.md, Abschnitt 4.
set -uo pipefail

A="${1:?WORKSPACE_A fehlt}"; B="${2:?WORKSPACE_B fehlt}"

echo "-- Workspace A: $A --"
ant auth login --profile test-a --workspace-id "$A"
ant profile activate test-a

AGENT=$(ant beta:agents create --transform id -r <<'YAML'
name: Bindungstest
model:
  id: claude-sonnet-4-6
system: |
  Du bist ein Wegwerf-Agent fuer einen Workspace-Bindungstest. Antworte nur "ok".
YAML
)
echo "Agent in A angelegt:        $AGENT"

ENVI=$(ant beta:environments create --transform id -r <<'YAML'
name: bindungstest
config:
  type: cloud
  networking:
    type: limited
    allowed_hosts: []
YAML
)
echo "Environment in A angelegt:  $ENVI"

echo
echo "-- Zugriff aus Workspace B: $B --"
ant auth login --profile test-b --workspace-id "$B"
ant profile activate test-b

if ant beta:agents get --agent-id "$AGENT" >/dev/null 2>&1; then
  echo "AGENT:        organisationsweit sichtbar"
else
  echo "AGENT:        workspace-gebunden"
fi

if ant beta:environments get --environment-id "$ENVI" >/dev/null 2>&1; then
  echo "ENVIRONMENT:  organisationsweit sichtbar"
else
  echo "ENVIRONMENT:  workspace-gebunden"
fi

echo
echo "Aufraeumen: beide Testobjekte in Workspace A archivieren."
echo "Ergebnis mit Datum in claude/09_Console-Kompendium.md eintragen."
