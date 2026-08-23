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

## Voraussetzung

Das Skript braucht **reportlab**. Im Cloud-Image der Managed Agents ist es
vorhanden (gemessen am 23.08.2026: reportlab 5.0.0) — du musst nichts
installieren.

Bricht der Aufruf trotzdem mit `ModuleNotFoundError` ab, läufst du in einer
anderen Umgebung. Paketmanager sind dort in der Regel gesperrt, du kannst es
also nicht nachziehen. Melde den Fehler wörtlich, statt ein Ersatz-PDF zu bauen.

## Was das Skript erkennt

| In der Quelle | Im PDF |
|---|---|
| `# Überschrift` | Kapitel auf neuer Seite, Petrol-Linie darunter |
| `## Überschrift` | Zwischenüberschrift in Archivo |
| `### Überschrift` | Unterüberschrift in Petrol |
| Kästen aus `═ ║ ╔` | gesetzte Titelfläche, Text unverändert |
| Tabellen | Kopf als Mono-Label, Zahlenzellen in der Mono, Kopf wiederholt sich über Seiten |
| `- [ ]` / `- [x]` | Checkliste: hohler Punkt = offen, gefüllter Punkt = erledigt |
| `> Zitat` | ein Block mit Petrol-Haarlinie, auch über mehrere Zeilen |
| `[ANALYST: …]` | in Petrol hervorgehoben |
| `[ABGELEITET]` | in der Mono, gedämpft |
| „Orientierungsbeispiel — kein finaler Text" | kursiv, gedämpft |
| Codeblöcke, Listen, `**fett**`, `*kursiv*`, Links | gesetzt |

Titel und Untertitel des Deckblatts nimmt das Skript aus dem ersten Kasten
oder der ersten Überschrift. Es erfindet nichts — kein Datum, keinen
Kundennamen, keine Fußzeile mit Angaben, die nicht in der Quelle stehen.

## Gestaltung

Farben, Schrift und Formen stammen aus dem Design-Handoff „KANA AI —
Relaunch": helle Welt, **Petrol `#1F4B45` als einzige Akzentfarbe**, Flächen
`#FBFAF7` / `#F6F4EF` / `#F1EFE9`, Text `#14181A`. Meta-Text wird nie heller
als `#5F6866` gesetzt — das ist die Kontrastuntergrenze aus dem Handoff.

**Keine Radien, keine Schatten.** Der Handoff setzt quadratisch als Standard;
Tiefe entsteht über Haarlinien und die drei Flächenstufen. Das frühere
Leuchten gehörte zur dunklen Welt und ist ersatzlos entfallen.

**Das Deckblatt ist hell wie die Landingpage** und trägt das Orbital als
Hintergrundmotiv: Kern, erste Bahn mit den vier Abteilungen, zweite Bahn mit
den Agents, darum der offene Bogen. Dasselbe Zeichen steht klein in der
Kopfzeile des Deckblatts und in der Fußzeile jeder Inhaltsseite.

Der Bogen läuft über 270°, die Öffnung liegt **rechts** — dadurch steht der
sichtbare Bogen links neben dem Kern. Das ist die entscheidende Ausrichtung.

## Schriften

Diese sechs Dateien liegen neben dem Skript und werden eingebettet:

    Archivo-ExtraBold.ttf            Wortmarke, Deckblatt-Titel, Kapitel
    Archivo-Bold.ttf                 Abschnittsüberschriften
    FamiljenGrotesk-Regular.ttf      Fließtext
    FamiljenGrotesk-SemiBold.ttf     halbfett
    FamiljenGrotesk-Italic.ttf       kursiv
    JetBrainsMono-Regular.ttf        Zahlen, Labels, Code, Seitenzahlen

Fehlt eine davon, weicht das Skript auf DejaVu Sans aus und **nennt die
fehlenden Dateien in seiner Ausgabe**. Steht in der Zeile `Schrift:` etwas
anderes als `Archivo + Familjen Grotesk + JetBrains Mono`, ist das Bundle
unvollständig — melde es.

**Nicht auf die eingebauten reportlab-Schriften ausweichen.** Denen fehlen
Zeichen wie • — sie werden dann still durch ASCII ersetzt oder als schwarze
Kästen gesetzt.

**Checklisten-Zeichen werden gezeichnet, nicht gesetzt.** Die CI-Schriften
führen ☐ und ☑ zwar im cmap, setzen sie aber als leere Kästen — das fällt erst
im fertigen PDF auf. Das Skript zeichnet stattdessen Kreise nach der
Portal-Legende: gefüllt = erledigt, hohl = offen.

## Änderungen am Erscheinungsbild

Ausschließlich in `kana_pdf.py`, nie im Prompt eines Agenten. Danach das Skill
neu hochladen — dabei **immer alle Dateien** mitschicken, auch die sechs
Schriftdateien: weggelassene Dateien werden nicht aus der Vorversion
übernommen.

## kana-ci.css

Enthält dieselben Gestaltungswerte als Stylesheet, inklusive Signet und
Orbital aus reinem CSS. Wird für PDFs **nicht** gebraucht — `kana_pdf.py`
arbeitet mit reportlab, nicht mit HTML. Die Datei liegt bei für HTML-Ausgaben
wie Web-Ansicht, Rechnung oder E-Mail, damit die Werte an einer Stelle stehen.
