# Dokumentenbauer — Console-Fassung

**Neu, kein Altcode-Gegenstück.** Ersetzt `lib/pdf/pdfEngine.ts`.

Setzt Markdown-Berichte als Kunden-PDF. Läuft als **Unteragent** im Roster des
Creative Strategist — eine Session, ein Budget, ein Verbrauchsdatensatz.

## Warum ein eigener Agent statt eines Skills am Strategisten

1. **Ein Layout statt drei.** Analyst und Brand Expert liefern auch Berichte.
2. **Die Gegenprobe.** Ein Skill ändert, wann Claude etwas heranzieht. Solange
   der Vergleich mit dem Altagenten aussteht, bleibt der Strategist unberührt.

## Das Erscheinungsbild

Steht im Skill `KANA Corporate Design` (`skill_01LYvZGZuJcjT7RgggMCZpyd`),
nicht im Prompt. Quelle liegt hier unter `werkzeuge/`:

| Datei | Zweck |
|---|---|
| `kana_pdf.py` | erzeugt das PDF. **Ein Aufruf, kein Layoutentwurf.** |
| `SKILL.md` | Anleitung für den Agenten |
| `kana-ci.css` | dieselben Werte als Stylesheet — für spätere HTML-Ausgaben |

**Änderungen am Design passieren in `kana_pdf.py`, danach Skill neu hochladen.**
Dabei immer alle Dateien mitschicken — weggelassene werden nicht übernommen.

## Befund vom 17.08.2026, der zu diesem Aufbau geführt hat

Erster Versuch: Gestaltung im Prompt beschrieben, CSS als Träger.
Ergebnis: Helvetica statt Inter, Altrosa statt Indigo, 12.500 Ausgabe-Tokens,
**45 Cent allein für das PDF** — der Lauf verdoppelte sich von 40 auf 85 Cent.

Ursache: Der `pdf`-Skill arbeitet mit **reportlab**, nicht mit HTML und CSS.
Ein Stylesheet kann er nicht lesen. Und der Agent hat den ganzen Bericht durch
das Modell geschickt, um ihn neu zu setzen.

Mit `kana_pdf.py` ruft er eine Zeile auf. Rund 100 Ausgabe-Tokens statt 12.500.

> **Layout ist Rechnung, keine Einschätzung** — dasselbe Prinzip wie bei
> `filter.js` und `score.js`.

## Offen

- **Inter-Schriftdateien fehlen im Skill.** Ohne sie weicht `kana_pdf.py` auf
  DejaVu Sans aus und sagt das in seiner Ausgabe. Vier TTFs von Google Fonts
  (`Inter-Regular`, `-SemiBold`, `-Black`, `-Italic`) neben `kana_pdf.py`
  legen und das Skill neu hochladen.
- Skill ist workspace-gebunden — bei einem Workspace je Kunde in jeden hinein.
