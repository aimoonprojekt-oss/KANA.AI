---
name: kana-corporate-design
description: Verbindliches Erscheinungsbild von KANA AI für Dokumente an Kunden. Enthält kana_pdf.py, das aus einer Markdown-Datei ein fertiges PDF im KANA-Design erzeugt. Immer verwenden, wenn ein Bericht als PDF gesetzt oder ein Dokument für Kunden ausgeliefert wird.
---

# KANA AI — Corporate Design

## Das Wichtigste zuerst

Ein PDF wird nicht beschrieben, sondern erzeugt. Ein Aufruf:

    python3 kana_pdf.py <quelle.md> <ziel.pdf>

Das ist alles. Kein HTML bauen, kein Layout entwerfen, keine Farben wählen,
den Text nicht abschreiben. Das Skript liest die Markdown-Datei und schreibt
das PDF.

Findest du das Skript nicht:

    find / -name kana_pdf.py -not -path "*/proc/*" 2>/dev/null | head -1

**Warum als Skript und nicht als Anleitung:** Layout ist Rechnung, keine
Einschätzung. Ein beschriebenes Layout wird bei jedem Lauf ein wenig anders —
zwei Dokumente aus derselben Quelle sähen verschieden aus. Und der Umweg über
den Modellkontext kostet bei einem Bericht von 40 KB ein Vielfaches des
Aufrufs.

Das Skript gibt aus: Zieldatei, Seitenzahl, Größe, verwendete Schrift, Titel.
Diese Angaben übernimmst du unverändert in deine Meldung.

## Was das Skript erkennt

| In der Quelle | Im PDF |
|---|---|
| `# Überschrift` | Kapitel auf neuer Seite, Akzentlinie darunter |
| `## Überschrift` | Zwischenüberschrift |
| `### Überschrift` | Unterüberschrift in Indigo |
| Kästen aus `═ ║ ╔` | gesetzte Titelfläche, Text unverändert |
| Tabellen | gesetzte Tabelle, Kopfzeile getönt, Kopf wiederholt sich über Seiten |
| `- [ ]` / `- [x]` | Checkliste mit Kästchen |
| `[ANALYST: …]` | indigo hervorgehoben |
| `[ABGELEITET]` | grau hervorgehoben |
| „Orientierungsbeispiel — kein finaler Text" | kursiv, gedämpft |
| Codeblöcke, Zitate, Listen, `**fett**`, `*kursiv*`, Links | gesetzt |

Titel und Untertitel des Deckblatts nimmt das Skript aus dem ersten Kasten
oder der ersten Überschrift. Es erfindet nichts — kein Datum, keinen
Kundennamen, keine Fußzeile mit Angaben, die nicht in der Quelle stehen.

## Gestaltung

Farben und Schrift stammen aus `app/globals.css` der Plattform:
Akzent `#6366F1`, Deckblatt `#060A13`, Schrift Inter.

Das **Deckblatt ist dunkel wie die Website, der Inhalt hell.** Bewusst so: ein
mehrseitiges dunkles PDF ist am Bildschirm ermüdend und beim Ausdrucken
unbrauchbar. Die Wiedererkennung trägt das Deckblatt.

## Schriften

Liegen `Inter-Regular.ttf`, `Inter-SemiBold.ttf`, `Inter-Black.ttf` und
`Inter-Italic.ttf` neben diesem Skill, wird Inter verwendet. Sonst weicht das
Skript auf DejaVu Sans aus und sagt das in seiner Ausgabe.

**Nicht auf die eingebauten reportlab-Schriften ausweichen.** Denen fehlen
Zeichen wie ☐ • ◦ — sie werden dann still durch ASCII ersetzt oder als
schwarze Kästen gesetzt.

## Änderungen am Erscheinungsbild

Ausschließlich in `kana_pdf.py`, nie im Prompt eines Agenten. Danach das Skill
neu hochladen — dabei **immer alle Dateien** mitschicken: weggelassene Dateien
werden nicht aus der Vorversion übernommen.

## kana-ci.css

Enthält dieselben Gestaltungswerte als Stylesheet. Wird für PDFs **nicht**
gebraucht — der `pdf`-Skill arbeitet mit reportlab, nicht mit HTML. Die Datei
liegt bei für spätere HTML-Ausgaben wie Web-Ansicht oder E-Mail, damit die
Werte an einer Stelle stehen.
