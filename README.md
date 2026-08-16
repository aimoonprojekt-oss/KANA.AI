# KANA AI — Plattform

Verkauf von KI-Agenten als **digitale Mitarbeiter**, organisiert in
Abteilungen. Unternehmen buchen einen Agenten oder eine ganze Abteilung und
lassen ihn arbeiten — ohne eigene Entwickler.

Dieses Repository enthält die **Plattform**: Website, Kundenportal, Admin,
Abrechnung. Die Agenten selbst leben als *Managed Agents* in der Claude
Console.

> **Anthropic hält das Können. KANA hält das Geschäft.**

---

## In fünf Minuten starten

```bash
git clone https://github.com/aimoonprojekt-oss/KANA.AI.git
cd KANA.AI
npm install
cp .env.local.example .env.local     # Werte aus dem Passwortmanager eintragen
npm run dev                          # http://localhost:3000
```

Ausführlich: [`docs/ANLEITUNG.md`](docs/ANLEITUNG.md)

---

## Wo finde ich was

| Frage | Antwort |
|---|---|
| Wie ist das System aufgebaut? | `docs/ARCHITEKTUR.md` |
| Wie richte ich das von null ein? | `docs/ANLEITUNG.md` |
| Wie arbeiten wir zusammen? | Playbook im Claude-Projekt „KANA AI" |
| Was wurde wann geändert? | `CHANGELOG.md` |
| Warum haben wir X so gemacht? | `docs/entscheidungen/` |
| Was ist noch zu tun? | GitHub Issues und das Project Board |

Unternehmensdokumente — Statusbericht, Roadmap, Playbook, Ablagestruktur —
liegen im **Claude-Projekt „KANA AI"**, nicht hier. Hier liegt nur, was zum
Produkt gehört.

---

## Stack

| Bereich | Technologie |
|---|---|
| Anwendung | Next.js 15, TypeScript, React 18 |
| Anmeldung | Clerk |
| Datenbank und Dateien | Supabase |
| Betrieb | Railway |
| Zahlungen | Stripe |
| Agenten | Anthropic Managed Agents (Beta) |

---

## Die Grenze zwischen Console und Plattform

| In der Claude Console | Bei uns |
|---|---|
| Prompts, Werkzeuge, Skills, MCP-Server | Wer ist Kunde, was hat er gebucht |
| Ausführung, Sandbox, Dateierzeugung | Berechtigung und Kontingent vor dem Start |
| Zugangsdaten für Fremdsysteme (Vaults) | Verbrauch je Lauf, Rechnung |
| Agenten-Versionierung | Ergebnisse über 30 Tage hinaus |

**Die Console ist die Werkbank, dieses Repo ist das Archiv.** Nach jeder
Änderung an einem Agenten wird die Definition ins Repo geholt und im Pull
Request geprüft — es gibt keine Kundenkopien mehr, eine Prompt-Änderung
wirkt sofort für alle Kunden.

---

## Mitarbeiten

Der Ablauf in Kurzform. Vollständig im Playbook, Abschnitt 3.

```bash
git checkout main && git pull        # immer, ausnahmslos
git checkout -b feat/kurzer-name     # eigener Branch
# arbeiten, kleine Commits
npx tsc --noEmit && npm run build    # vor jedem Push
git push -u origin feat/kurzer-name
# Pull Request nach develop, zweites Augenpaar, dann Merge
```

**Drei Regeln, die nicht verhandelbar sind:**

1. Kein direkter Push auf `main`. Das ist technisch erzwungen.
2. Kein Merge bei rotem CI-Check.
3. Jeder Pull Request braucht ein zweites Augenpaar — auch wenn der Blick
   nur zwei Minuten dauert.

---

## Zugangsdaten

Niemals in Git. Auch nicht kurz — die Historie vergisst nichts.

| Was | Wo |
|---|---|
| Produktion | Railway Environment Variables |
| Staging | Railway, getrennte Umgebung, Test-Schlüssel |
| Lokal | `.env.local` (steht in `.gitignore`) |
| Im Team teilen | Passwortmanager |
| Welche Schlüssel nötig sind | `.env.local.example` — ohne echte Werte |

Falls doch einmal ein Schlüssel im Repo landet: **sofort beim Anbieter
widerrufen und neu erzeugen.**

---

## Sicherung

```bash
./scripts/sicherung.sh
```

Schreibt Repository, Datenbankabzug, Agentenliste und Variablenvorlage in
einen Ordner außerhalb des Repos. Details stehen im Skript.

> Eine Sicherung, die nie wiederhergestellt wurde, ist keine Sicherung.
> Einmal im Quartal gegen das Staging-Projekt durchspielen.
