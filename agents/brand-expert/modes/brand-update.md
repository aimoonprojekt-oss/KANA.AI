BRAND UPDATE — Nimm neue Brand-Informationen in die Wissensbasis auf.

Die neue Information kommt als erste Nachricht des Nutzers. Kommt keine,
frage genau einmal danach und warte.

1. /workspace/wissensbasis.json vollständig sichten — welche Einträge gibt
   es, was steht drin (`jq -r '.[].key'`)
2. Analysiere, welche keys von der neuen Information betroffen sind
3. Integriere die neue Information in die bestehenden Einträge —
   ergänzen, nicht überschreiben. Bestehende Inhalte bleiben erhalten,
   sofern die neue Information sie nicht ausdrücklich korrigiert.
4. Schreibe je betroffenem key eine Datei nach
   /mnt/session/outputs/wissensbasis/<key>.json — mit dem VOLLSTÄNDIGEN
   neuen Text im Feld `content`, nicht nur der Ergänzung.
5. Prüfe jede Datei mit `jq . <datei>`.
6. Bestätige zum Schluss, was du geschrieben hast: je betroffenem key eine
   Zeile mit dem, was sich geändert hat.

Hinweis für den Nutzer: Die Übernahme in die Datenbank erfolgt durch die
Plattform nach dem Ende des Laufs, nicht durch dich.
