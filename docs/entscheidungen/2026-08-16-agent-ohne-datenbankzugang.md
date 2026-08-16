# Entscheidung: Der Agent bekommt keinen Datenbankzugang

**Datum:** 2026-08-16
**Beteiligt:** Kai
**Status:** beschlossen
**Ersetzt:** „Weg B" aus `agents/README.md` vom 15.08.2026

## Situation

Bei der Migration des Brand Expert auf Managed Agents wurde am 15.08. der Weg
gewählt, dass der Agent Supabase selbst per `bash`/`curl` aus der Sandbox
aufruft. Dafür liegt der `SUPABASE_SERVICE_ROLE_KEY` als
`environment_variable`-Credential in einem Vault: Im Container steht nur ein
Platzhalter, der echte Wert wird erst beim ausgehenden Request eingesetzt und ist
für Code in der Sandbox nicht lesbar.

Der Ansatz ist technisch elegant und war für einen Machbarkeits-Test mit einem
einzigen, admin-only genutzten Agenten vertretbar.

Einen Tag später wurde die Zielarchitektur beschlossen
(`05_Zielarchitektur_Managed_Agents.md`, Punkt 3). Sie hält ausdrücklich fest,
dass der Agent keinen Datenbankzugang haben darf. Damit stand die Umsetzung vom
15.08. im Widerspruch zur Architektur vom 16.08.

Verschärfend kam am 16.08. ein zweiter Befund hinzu: In
`docs/supabase-schema.sql` ist Row Level Security nur für `agent_access` und
`sessions` aktiviert. Für `brand_knowledge`, `strategist_knowledge`,
`analyst_knowledge`, `analyst_results` und `analyst_breakdowns` fehlt sie. Der
`service_role`-Schlüssel ist damit derzeit nicht die zusätzliche, sondern die
**einzige** Absicherung dieser Daten.

## Optionen

1. **Weg B beibehalten.** Der Agent hält den `service_role`-Schlüssel. Schnell,
   funktioniert nachweislich, das Backend ist nicht im Pfad.
2. **Enger Schreib-Endpunkt.** Eigene Route im KANA-Backend, die der Agent per
   Token aufruft. Mandant wird serverseitig gesetzt, Rechte sind eng.
3. **Kontext-Übergabe.** Das Backend legt die Wissensbasis beim Start in die
   Session und übernimmt die Ergebnisdateien nach dem Lauf. Der Agent hat
   überhaupt keinen Netzzugang zur Datenbank.

## Entscheidung

**Option 3.**

## Begründung

Der `service_role`-Schlüssel umgeht Row Level Security und gewährt Vollzugriff auf
**alle** Mandanten. Sobald es mehr als einen Kunden gibt, hinge die Trennung
zwischen ihnen daran, dass ein Sprachmodell die richtige Datenbankabfrage
formuliert. Ein Prompt-Injection-Treffer in einer gescrapten Trustpilot-Rezension
oder in einer Meta-Anzeige — also in genau den Daten, die dieser Agent
verarbeitet — reicht dann aus.

Option 2 wäre vertretbar, verlagert das Problem aber nur: Es braucht trotzdem ein
Token im Agenten, eine Authentifizierung und eine Rechteprüfung. Der Aufwand ist
ähnlich, das Ergebnis schwächer.

Bei Option 3 ist der entscheidende Punkt nicht die Datei, sondern **woher die
`tenant_id` beim Zurückschreiben kommt**: aus dem Laufdatensatz im Backend,
niemals aus einer Angabe des Agenten. Selbst ein vollständig übernommener Agent
kann nicht in die Daten eines anderen Mandanten schreiben.

Dazu kommen drei Nebeneffekte, die für sich genommen schon den Ausschlag gäben:
Der übergebene Kontext ist gut zwischenspeicherbar und senkt die Kosten je Lauf.
Der System-Prompt enthält keine Markendaten mehr und gilt damit für alle
Mandanten — Voraussetzung für den Master-Agenten ohne Kundenkopien. Und der Vault
schrumpft von zwei Credentials auf eines.

## Folgen

- `agents/brand-expert.agent.yaml` überarbeitet: keine Supabase-Aufrufe, Lesen aus
  `/workspace/wissensbasis.json`, Schreiben nach
  `/mnt/session/outputs/wissensbasis/<key>.json`.
- Der Basis-Prompt ist mandantenneutral. Markendaten kommen aus der Wissensbasis.
- `allowed_hosts` verliert den Supabase-Host: nur noch `api.apify.com`,
  `www.sinsnlashes.com`, `www.facebook.com`.
- Der Vault enthält nur noch das Apify-Credential. Ein bereits angelegtes
  Supabase-Credential ist zu löschen, und der `SUPABASE_SERVICE_ROLE_KEY` ist zu
  **rotieren**, weil er in einem Vault gelegen hat.
- **Neuer Aufwand:** Das Backend muss die Wissensbasis bereitstellen und die
  Ergebnisdateien nach dem Lauf validieren und übernehmen. Der Vertrag steht in
  `agents/README.md`. Vorher ist der Agent nicht lauffähig — das ist der Preis
  dieser Entscheidung und beträgt schätzungsweise zwei bis drei Tage.
- Ein geplantes Deployment in der Console umgeht Kontext-Übergabe **und**
  Kontingentprüfung. Wiederkehrende Läufe steuern wir selbst.
- Unabhängig davon: RLS auf den fünf offenen Tabellen aktivieren. Siehe
  `rls_pruefen_und_absichern.sql`.

## Was an Weg B gut war

Der Vault-Mechanismus mit Platzhalter im Container und Einsetzung erst beim
ausgehenden Request ist die richtige Lösung für **Fremdsystem-Zugangsdaten** und
bleibt für Apify genau so bestehen. Verworfen wird nicht der Mechanismus, sondern
seine Anwendung auf die eigene Datenbank. Die Arbeit vom 15.08. — Modi,
Tool-Zuordnung, Environment- und Console-Eigenheiten — bleibt vollständig gültig.
