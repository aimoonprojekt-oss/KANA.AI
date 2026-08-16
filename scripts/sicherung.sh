#!/usr/bin/env bash
#
# KANA AI - Sicherung
#
# Schreibt alles, was nicht durch Git geschützt ist, in einen Ordner:
#   1. Repository als Offline-Bundle (alle Commits, alle Branches)
#   2. Datenbankabzug aus Supabase
#   3. Liste der Agenten-Definitionen aus der Claude Console
#   4. Vorlage der benötigten Umgebungsvariablen (OHNE Werte)
#
# Aufruf:
#   ./scripts/sicherung.sh [zielordner]
#
# Ohne Argument wird ~/kana-sicherungen/JJJJ-MM-TT_HHMM verwendet.
#
# WICHTIG: Der Zielordner darf NICHT im Repo-Ordner liegen und nicht in
# demselben Cloud-Ordner wie das Repo. Eine Sicherung neben dem Original
# hilft beim Ausfall nicht.
#
# Und: Eine Sicherung, die nie wiederhergestellt wurde, ist keine Sicherung.
# Siehe Abschnitt "Wiederherstellung testen" am Ende dieser Datei.

set -euo pipefail

# ---------------------------------------------------------------- Vorbereitung

REPO_WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEMPEL="$(date +%Y-%m-%d_%H%M)"
ZIEL="${1:-$HOME/kana-sicherungen/$STEMPEL}"

blau()  { printf '\033[0;34m%s\033[0m\n' "$*"; }
gruen() { printf '\033[0;32m%s\033[0m\n' "$*"; }
gelb()  { printf '\033[0;33m%s\033[0m\n' "$*"; }
rot()   { printf '\033[0;31m%s\033[0m\n' "$*"; }

# Zielordner darf nicht im Repo liegen
case "$(cd "$(dirname "$ZIEL")" 2>/dev/null && pwd || echo "$ZIEL")" in
  "$REPO_WURZEL"*)
    rot "Der Zielordner liegt im Repository-Ordner."
    rot "Eine Sicherung neben dem Original ist keine Sicherung. Abbruch."
    exit 1
    ;;
esac

mkdir -p "$ZIEL"
blau "Sicherung nach: $ZIEL"
echo

# Optionale .env.local für die Zugangsdaten einlesen
if [ -f "$REPO_WURZEL/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_WURZEL/.env.local"
  set +a
fi

FEHLT=()

# ------------------------------------------------------------ 1. Repository

blau "[1/4] Repository als Offline-Bundle"
git -C "$REPO_WURZEL" bundle create "$ZIEL/repo_$STEMPEL.bundle" --all
ANZAHL="$(git -C "$REPO_WURZEL" rev-list --count --all)"
gruen "      $ANZAHL Commits gesichert"

# Sofort gegenprüfen - ein kaputtes Bundle merkt man sonst erst im Ernstfall
git bundle verify "$ZIEL/repo_$STEMPEL.bundle" > /dev/null 2>&1 \
  && gruen "      Bundle geprüft, ist lesbar" \
  || { rot "      Bundle ist beschädigt. Abbruch."; exit 1; }
echo

# -------------------------------------------------------------- 2. Datenbank

blau "[2/4] Supabase-Datenbank"
if [ -n "${SUPABASE_DB_URL:-}" ] && command -v pg_dump > /dev/null 2>&1; then
  pg_dump "$SUPABASE_DB_URL" \
    --no-owner --no-privileges --clean --if-exists \
    --file "$ZIEL/datenbank_$STEMPEL.sql"
  GROESSE="$(du -h "$ZIEL/datenbank_$STEMPEL.sql" | cut -f1)"
  gruen "      Abzug erstellt ($GROESSE)"
else
  if [ -z "${SUPABASE_DB_URL:-}" ]; then
    gelb "      Übersprungen: SUPABASE_DB_URL ist nicht gesetzt."
    gelb "      Zu finden unter: Supabase -> Project Settings -> Database"
    gelb "      -> Connection string -> URI"
    FEHLT+=("Datenbankabzug (SUPABASE_DB_URL fehlt)")
  else
    gelb "      Übersprungen: pg_dump ist nicht installiert."
    gelb "      macOS: brew install libpq && brew link --force libpq"
    gelb "      Ubuntu: sudo apt install postgresql-client"
    FEHLT+=("Datenbankabzug (pg_dump fehlt)")
  fi
fi
echo

# ---------------------------------------------------------------- 3. Agenten

blau "[3/4] Agenten-Definitionen aus der Claude Console"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  if curl -sS --fail-with-body \
       -H "x-api-key: $ANTHROPIC_API_KEY" \
       -H "anthropic-version: 2023-06-01" \
       -H "anthropic-beta: agents-2025-11-24" \
       "https://api.anthropic.com/v1/agents?limit=100" \
       -o "$ZIEL/agenten_$STEMPEL.json" 2> "$ZIEL/.agenten.fehler"; then
    gruen "      Agentenliste gesichert"
    rm -f "$ZIEL/.agenten.fehler"
  else
    gelb "      Abruf fehlgeschlagen. Details:"
    sed 's/^/      /' "$ZIEL/.agenten.fehler" || true
    gelb "      Hinweis: Managed Agents sind Beta - der Beta-Header oben"
    gelb "      muss ggf. an die aktuelle Dokumentation angepasst werden."
    FEHLT+=("Agenten-Definitionen (Abruf fehlgeschlagen)")
  fi
else
  gelb "      Übersprungen: ANTHROPIC_API_KEY ist nicht gesetzt."
  FEHLT+=("Agenten-Definitionen (ANTHROPIC_API_KEY fehlt)")
fi
echo

# ------------------------------------------------------- 4. Variablenvorlage

blau "[4/4] Vorlage der Umgebungsvariablen (ohne Werte)"
{
  echo "# Benötigte Umgebungsvariablen - Stand $STEMPEL"
  echo "#"
  echo "# Diese Datei enthält ABSICHTLICH keine Werte."
  echo "# Die echten Werte liegen im Passwortmanager und in Railway."
  echo "# Sie gehören niemals in eine Sicherungsdatei, die herumliegt."
  echo
  if [ -f "$REPO_WURZEL/.env.local" ]; then
    grep -E '^[A-Z_][A-Z0-9_]*=' "$REPO_WURZEL/.env.local" \
      | cut -d= -f1 | sort -u | sed 's/$/=/'
  else
    grep -E '^[A-Z_][A-Z0-9_]*=' "$REPO_WURZEL/.env.local.example" \
      | cut -d= -f1 | sort -u | sed 's/$/=/'
  fi
} > "$ZIEL/variablen_$STEMPEL.txt"
gruen "      $(grep -c '=' "$ZIEL/variablen_$STEMPEL.txt") Variablennamen notiert"
echo

# ------------------------------------------------------------------ Abschluss

cat > "$ZIEL/LIESMICH.txt" <<TEXT
KANA AI - Sicherung vom $STEMPEL
========================================

Inhalt
------
repo_$STEMPEL.bundle       Vollständiges Repository, $ANZAHL Commits
datenbank_$STEMPEL.sql     Supabase-Abzug (falls erstellt)
agenten_$STEMPEL.json      Agenten-Definitionen aus der Console (falls erstellt)
variablen_$STEMPEL.txt     Namen der benötigten Variablen, ohne Werte

Was hier NICHT drin ist
-----------------------
- Vault-Inhalte bei Anthropic (nicht auslesbar, nur neu befüllen)
- Erzeugte Dateien im Supabase Storage
- Werte der Umgebungsvariablen (die liegen im Passwortmanager)

Wiederherstellung
-----------------
Repository:
    git clone repo_$STEMPEL.bundle KANA.AI
    cd KANA.AI && git log --oneline | head

Datenbank (NUR gegen ein Test-/Staging-Projekt, niemals blind gegen Produktion):
    psql "\$SUPABASE_DB_URL_STAGING" -f datenbank_$STEMPEL.sql

Agenten:
    agenten_$STEMPEL.json öffnen und die Definitionen in der Console
    neu anlegen. Es gibt keinen automatischen Rückweg.

Die Regel
---------
Eine Sicherung, die nie wiederhergestellt wurde, ist keine Sicherung.
Einmal im Quartal gegen das Staging-Projekt durchspielen.
TEXT

blau "Fertig."
gruen "Ordner: $ZIEL"
du -sh "$ZIEL" | sed 's/^/  /'
echo

if [ ${#FEHLT[@]} -gt 0 ]; then
  gelb "Unvollständig - folgende Teile fehlen:"
  for eintrag in "${FEHLT[@]}"; do
    gelb "  - $eintrag"
  done
  echo
  gelb "Das ist keine vollständige Sicherung. Bitte nachziehen."
  exit 2
fi

gruen "Alle vier Teile vorhanden."
echo
gelb "Nicht vergessen: Ordner an einen ZWEITEN Ort kopieren."
gelb "Nicht dorthin, wo das Repo liegt."
