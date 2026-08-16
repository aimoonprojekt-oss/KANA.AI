<!--
Kurz halten. Diese Vorlage ersetzt keine Diskussion, sie stellt nur sicher,
dass der zweite Gründer in zwei Minuten versteht, worum es geht.
-->

## Was ändert sich

<!-- Ein bis drei Sätze. Was tut der Code nachher, was er vorher nicht tat? -->

## Warum

<!-- Verweis auf das Issue: "Schließt #12" -->

Schließt #

## Wie geprüft

<!-- Was hast du konkret getestet? "Läuft bei mir" ist keine Prüfung. -->

- [ ] `npx tsc --noEmit` läuft lokal ohne Fehler
- [ ] `npm run build` läuft lokal ohne Fehler
- [ ] Auf Staging mit realistischen Daten getestet

## Checkliste (aus dem Playbook, Abschnitt 4)

- [ ] Der Code tut, was das Issue beschreibt
- [ ] `docs/ARCHITEKTUR.md` angepasst, falls sich etwas Strukturelles geändert hat
- [ ] `CHANGELOG.md` ergänzt
- [ ] Keine Secrets im Code, keine auskommentierten Reste, keine Debug-Ausgaben
- [ ] Migrationen nur **ergänzt**, keine bestehende Migration verändert
- [ ] Bei Änderungen an `agents/`: Auswirkung auf **alle** Kunden bedacht — es gibt keine Kundenkopien mehr

## Risiko

<!-- Was geht kaputt, wenn das schiefgeht? Wie rollen wir zurück? -->
