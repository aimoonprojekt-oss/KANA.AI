# scripts/seed — FEHLT NOCH

**Status:** ⚠️ Dieser Ordner ist ein Platzhalter. Die eigentlichen Scripts
liegen ausschließlich auf einem einzelnen Rechner und sind nirgends gesichert.

## Worum es geht

Folgende Dateien bauen die Wissensbasis der Agenten in Supabase auf:

| Datei | Befüllt | Status |
|---|---|---|
| `seed_supabase.js` | `brand_knowledge` | ⚠️ nur lokal |
| `seed_analyst.js` | `analyst_knowledge` | ⚠️ nur lokal |
| `seed_strategist.js` | `strategist_knowledge` | ⚠️ nur lokal |

## Warum das dringend ist

Geht der Rechner verloren, lässt sich die Wissensbasis **nicht wieder
aufbauen**. Git schützt hier nichts, weil die Dateien nie eingecheckt wurden.
Das ist das größte einzelne Datenverlustrisiko im Projekt und steht seit dem
ersten Statusbericht offen.

## Was zu tun ist (30 Minuten)

1. Die drei Dateien auf dem Rechner suchen — vermutlich im Projektordner
   oder in einem `scripts/`-Unterordner.
2. **Vor dem Einchecken:** prüfen, ob Zugangsdaten darin stehen. Falls ja,
   durch `process.env.SUPABASE_SERVICE_ROLE_KEY` ersetzen. Keine Schlüssel
   ins Repo — auch nicht kurz, die Historie vergisst nichts.
3. Hierher kopieren, committen, per Pull Request einreichen.
4. Diese Datei durch eine echte Kurzanleitung ersetzen: was jedes Script
   tut, wie man es aufruft, welche Variablen es braucht.

## Beim Umbau auf Managed Agents

Die statischen Frameworks wandern als **Skills** zu Anthropic,
kundenspezifisches Wissen nach `tenant_knowledge`. Die Seed-Scripts werden
dadurch nicht überflüssig — sie sind die einzige Quelle für den heutigen
Inhalt und die Vorlage für die Datenübernahme.

**Erst sichern, dann umbauen.**
