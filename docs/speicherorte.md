# Wo Daten liegen

Stand 23. August 2026. Verbindlich für alle Agenten und für das Backend.

## Die Regel

> **Supabase ist das System of Record.
> Der Memory-Store ist der Arbeitsspeicher einer Sitzung.
> Die Files API ist eine Schleuse, kein Ablageort.**

Kein Agent spricht direkt mit Supabase. Das Backend projiziert vor der Sitzung
hinein und holt danach zurück. Der Weg ist immer derselbe:

```
Supabase ──projizieren──▶ kana-wissen (read_only)
                              │
                          Agent arbeitet
                              │
                          kana-ergebnisse (read_write)  ──▶ Supabase
                              │
                          /mnt/session/outputs/ ──▶ Files ──▶ Supabase Storage
```

## Drei Prüffragen, in dieser Reihenfolge

**1. Binär oder grösser als 100 KB?**
Dann weder Memory noch Supabase-Tabelle. PDFs, Bilder, Videos gehen über
Session-Outputs in Supabase Storage. Ein Memory-Eintrag nimmt nur Text bis
100 KB.

**2. Braucht es jemand ausserhalb einer laufenden Sitzung?**
Portal, Rechnung, Support, Auswertung, der Kunde selbst → **Supabase**. Alles,
was jemand sehen, filtern, sortieren oder joinen können muss, gehört in die
Datenbank. Ein Memory-Store ist ein Verzeichnis mit Textdateien, keine
Abfragesprache.

**3. Braucht es ein Agent während der Arbeit?**
→ **Memory**, aber als *Projektion*. Die Wahrheit bleibt in Supabase.

Fällt etwas unter 2 **und** 3 — wie das Markenwissen — liegt es in beiden, und
die Richtung ist festgelegt: Supabase ist das Original, Memory die Kopie für
die Dauer der Arbeit.

## Zuordnung

| Daten | Ort | Begründung |
|---|---|---|
| `organizations`, `agents`, `agent_access1` | Supabase | Mandanten, Katalog, Zugriffsrechte — kommen nie in einen Container |
| `sessions`, `runs` | Supabase | Laufakte und Abrechnung, beweispflichtig |
| `brand_knowledge` | Supabase → `kana-wissen/wissensbasis.json` | Kunde pflegt im Portal, Agent liest die Projektion |
| `ad_research` | Supabase → `kana-wissen/breakdowns.json` | Rohdaten bleiben abfragbar |
| `analyst_results` | `kana-ergebnisse/analysen/` → Supabase | Agent schreibt Memory, Backend übernimmt |
| REF-Dateien | `kana-wissen/referenzen.json` | Konfiguration, keine Kundendaten |
| `score.js` und Werkzeuge | `kana-wissen/` | Code, kein Datensatz |
| Strategy Guide `.md` | `kana-ergebnisse/guides/` | Zwischenprodukt der Sitzung |
| Strategy Guide `.pdf` | Session-Output → Storage `lieferungen` | binär, Prüffrage 1 |
| Zugangsdaten | **Vault, nirgends sonst** | Memories werden in jede spätere Sitzung zurückgespielt |

## Die Speicher

| Name | Zugriff | Inhalt |
|---|---|---|
| `kana-wissen` | read_only | `referenzen.json`, `wissensbasis.json`, `breakdowns.json`, `score.js` |
| `kana-ergebnisse` | read_write | `analysen/<ad_id>.json`, `guides/strategy-guide.md` |

Die **Anzeigenamen sind verbindlich**. Der Mount-Pfad entsteht aus ihnen
(`/mnt/memory/<name>/`) und steht wörtlich in den Agenten-Prompts. In jedem
Kundenworkspace müssen sie gleich heissen, sonst wird der Prompt
kundenspezifisch.

Warum zwei und nicht einer: Zugriff gilt pro Speicher, nicht pro Pfad. Ein
Agent, der die Wissensbasis eines Mandanten überschreiben kann, ist ein Agent
zu viel.

## Der Weg des PDF

Ein PDF ist binär und passt in keinen Memory-Store. Es bleibt Sitzungsausgabe:

1. Der Dokumentenbauer schreibt nach `/mnt/session/outputs/strategy-guide.pdf`
2. Die Files API fängt das **automatisch** ein — kein Upload nötig
3. Nach `session.status_idle` holt `lieferungenUebernehmen()` es ab
4. Ablage in Supabase Storage, Bucket `lieferungen`, Pfad
   `<organization_id>/<run_id>/<dateiname>`
5. Signierter Link (1 h) ans Chatfenster
6. Die Files API wird geleert

Drei Fallstricke, alle in `lib/agents/speicherProjektion.ts` behandelt:

- **Beide Beta-Header.** Die SDK-Files-Ressource setzt nur
  `files-api-2025-04-14` selbst. Ohne `managed-agents-2026-04-01` wird
  `scope_id` als unbekanntes Feld abgelehnt.
- **Indexierungslag.** Zwischen `idle` und dem Erscheinen in `files.list`
  liegen 1–3 Sekunden. Einmal leer heisst nicht „keine Datei".
- **Bucket ist privat.** `lieferungen` ist nicht öffentlich — ohne signierte
  URL kommt der Browser nicht an die Datei. (Der ältere Bucket `ad-videos` ist
  public; das sollte bei Gelegenheit geprüft werden.)
- **Bucket-Grenzen.** `lieferungen` nimmt 150 MB je Datei und die MIME-Typen
  PDF, Markdown, Text, JSON, MP4, JPEG, PNG. Der Creative Researcher lädt
  Videos bis 100 MB — ein engerer Filter hätte sie stillschweigend abgewiesen.

## Was das für die Agenten heisst

Sitzungsuploads (`/mnt/session/uploads/`) werden **nicht mehr benutzt**. Der
Mechanismus in `lib/agents/sessionRessourcen.ts` bleibt für den Creative
Researcher bestehen, ist für Analyst und Strategist aber abgelöst.

Der **Sub_Datenpfleger** bleibt bestehen, steht aber nicht mehr im Laufpfad:
Das Backend schreibt jetzt selbst über `memories.create` in den Speicher, mit
Validierung an der richtigen Stelle. Der Agent bleibt als Werkzeug für
Erstbefüllung und Handeingriffe verfügbar.

## Offene Punkte

- **Nebenläufigkeit.** Zwei Sitzungen mit `read_write` auf denselben Speicher
  überschreiben sich. Memory kennt `precondition: content_sha256` dagegen —
  einsetzen, sobald mehr als ein Agent gleichzeitig schreibt.
- **`wissensbasis.json` wächst.** Zwölf ausführliche Einträge sprengen 100 KB
  schnell. Dann ein Memory je Schlüssel (`wissensbasis/brand_identity.json`).
  Die Prompts von Analyst und Strategist lesen bereits beide Formen.
- **Vier leere Tabellen.** `strategist_knowledge`, `analyst_knowledge`,
  `analyst_breakdowns`, `research_sessions` haben 0 Zeilen und überschneiden
  sich mit `ad_research`/`analyst_results`. Vor dem Produktivgang entscheiden,
  welche bleiben — sonst zementiert die Projektion eine Redundanz.
