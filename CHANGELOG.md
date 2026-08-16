# Änderungsprotokoll

Neueste Einträge oben. Diese Datei wird **nur ergänzt**, nie umgeschrieben.

Für „wie ist das System aufgebaut" gilt `docs/ARCHITEKTUR.md` — die
beschreibt immer nur den *aktuellen* Zustand. Hier steht die Geschichte.

---

## 2026-08-16 — M0: Absicherung

**Warum:** Bis heute konnte ein einzelner Push auf `main` die Live-Plattform
lahmlegen. 97 Commits gingen direkt darauf, ohne Pull Request, ohne
automatische Prüfung. Mehrfach sind kaputte Builds in der Produktion
gelandet.

**Hinzugefügt**

- `.github/workflows/ci.yml` — Typprüfung, Build und Suche nach Zugangsdaten
  bei jedem Pull Request. Auf dem Stand `ba8e001` läuft beides grün, der
  Check kann also sofort als Merge-Voraussetzung erzwungen werden.
- `.github/pull_request_template.md` — Checkliste aus dem Playbook
- `README.md` — Einstiegspunkt
- `CHANGELOG.md` — diese Datei
- `scripts/sicherung.sh` — sichert Repository, Datenbankabzug, Agentenliste
  und Variablenvorlage in einen Ordner außerhalb des Repos
- `scripts/seed/LIESMICH.md` — Platzhalter, der die fehlenden Seed-Scripts
  sichtbar macht

**Noch offen**

- Die drei Seed-Scripts liegen weiterhin nur auf einem Rechner
- Branch-Schutz auf `main` muss in den GitHub-Einstellungen aktiviert werden
- Repository liegt noch in einem OneDrive-Ordner
- Staging-Umgebung fehlt

---

## 2026-08-15 — Managed Agents, erster Schritt (`ba8e001`)

`/api/chat` nutzt `sessions.create`, Vaults, Ereignisstrom und Files-API.
Beginn der Umstellung von eigener Agentenlogik auf Managed Agents.

Zu diesem Zeitpunkt noch enthalten und später zu korrigieren: Der Brand
Expert bekam den `SUPABASE_SERVICE_ROLE_KEY` per Vault, um die Wissensbasis
selbst zu lesen. Dieser Schlüssel umgeht RLS. Ersetzt durch: Das Backend
liest das Wissen und übergibt es beim Session-Start.

---

## Davor

Die Historie bis `ba8e001` steht in der Git-Historie und in
`docs/archiv/2026-08-16_CONTEXT_HANDOFF.md`.
