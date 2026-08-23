#!/usr/bin/env python3
"""
KANA AI — Markdown nach PDF im Corporate Design.

    python3 kana_pdf.py <quelle.md> <ziel.pdf>

Warum ein Skript und keine Beschreibung im Prompt:
Layout ist Rechnung, keine Einschaetzung. Ein beschriebenes Layout wird bei
jedem Lauf ein wenig anders. Dieses Skript erzeugt aus derselben Quelle immer
dasselbe Dokument — und kostet dabei fast nichts, weil der Agent den Text
nicht durch das Modell schicken muss.

Erscheinungsbild: Relaunch-Stand (helle Welt, Petrol als einzige Akzentfarbe,
Archivo / Familjen Grotesk / JetBrains Mono, quadratische Formen, Hairlines
statt Schatten). Quelle ist der Design-Handoff `kana_relaunch`.

Deckblatt hell mit dem Orbital-Motiv, Inhalt hell — durchgehend druckbar.
"""

import re
import sys
import os
import math
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether, NextPageTemplate,
)


# ── Farben (Design-Handoff, helle Welt) ───────────────────────────────────
def ueber(vorder, alpha, grund):
    """rgba auf einer Flaeche zu einem festen Wert verrechnen.

    Das PDF bekommt durchweg deckende Farben. Echte Transparenz sieht je nach
    Betrachter und Drucker anders aus — bei Hairlines faellt das sofort auf.
    """
    return colors.Color(*[(alpha * v + (1 - alpha) * g) for v, g in
                          zip(vorder.rgb(), grund.rgb())])


AKZENT        = colors.HexColor("#1F4B45")   # Petrol, einzige Akzentfarbe
AKZENT_DUNKEL = colors.HexColor("#14312D")
SEITE         = colors.HexColor("#FBFAF7")   # Inhaltsflaeche
FLAECHE       = colors.HexColor("#F6F4EF")   # abgesetzte Abschnitte, Deckblatt
FLAECHE_TIEF  = colors.HexColor("#F1EFE9")   # Musterflaechen, Tabellenkopf
TEXT          = colors.HexColor("#14181A")
TEXT_WEICH    = colors.HexColor("#4A5250")
TEXT_TERTIAER = colors.HexColor("#5A6260")
TEXT_STUMM    = colors.HexColor("#5F6866")   # Untergrenze auf Hell, ca. 5:1
ROT           = colors.HexColor("#8C3A32")

AKZENT_SOFT   = ueber(AKZENT, 0.08, SEITE)          # aktive Zeilen
AKZENT_RAND   = ueber(AKZENT, 0.30, SEITE)
HAIRLINE      = ueber(colors.HexColor("#14181A"), 0.10, SEITE)
HAIRLINE_SOFT = ueber(colors.HexColor("#14181A"), 0.06, SEITE)

# Als Hex-Zeichenketten fuer die Inline-Auszeichnung
HEX_AKZENT = "#1F4B45"
HEX_STUMM  = "#5F6866"

RAND = 20 * mm

# Kein Radius. Der Handoff setzt 0 als Standard — quadratisch bei Knoepfen,
# Karten, Rahmen und Eingabefeldern. Die 8-px-Ausnahme gilt nur fuer
# Verbrauch, Abrechnung und Preise im Portal, nicht fuer Dokumente.


# ── Schriften ─────────────────────────────────────────────────────────────
def schriften_registrieren():
    """Archivo + Familjen Grotesk + JetBrains Mono, wenn mitgeliefert.

    NICHT die eingebauten reportlab-Schriften nehmen: denen fehlen Zeichen wie
    ☐ ☑ • — sie werden dann still durch ASCII ersetzt oder als Kasten gesetzt.
    DejaVu Sans ist der Notnagel und wird in der Ausgabe genannt.
    """
    hier = Path(__file__).resolve().parent
    ci = {
        "KANA":         "FamiljenGrotesk-Regular.ttf",    # Fliesstext, UI
        "KANA-Bd":      "FamiljenGrotesk-SemiBold.ttf",   # halbfett
        "KANA-It":      "FamiljenGrotesk-Italic.ttf",     # kursiv
        "KANA-Display": "Archivo-ExtraBold.ttf",          # Wortmarke, Titel
        "KANA-H":       "Archivo-Bold.ttf",               # Kapitel, Abschnitte
        "KANA-Mono":    "JetBrainsMono-Regular.ttf",      # Zahlen, Labels
    }
    fehlend = [d for d in ci.values() if not (hier / d).exists()]

    if not fehlend:
        for name, datei in ci.items():
            pdfmetrics.registerFont(TTFont(name, str(hier / datei)))
        quelle = "Archivo + Familjen Grotesk + JetBrains Mono"
    else:
        d = "/usr/share/fonts/truetype/dejavu"
        paare = [("KANA", "DejaVuSans.ttf"), ("KANA-Bd", "DejaVuSans-Bold.ttf"),
                 ("KANA-It", "DejaVuSans-Oblique.ttf"),
                 ("KANA-Display", "DejaVuSans-Bold.ttf"),
                 ("KANA-H", "DejaVuSans-Bold.ttf"),
                 ("KANA-Mono", "DejaVuSansMono.ttf")]
        for name, datei in paare:
            pdfmetrics.registerFont(TTFont(name, os.path.join(d, datei)))
        quelle = f"DejaVu Sans (CI-Schriften fehlen: {', '.join(fehlend)})"

    pdfmetrics.registerFontFamily("KANA", normal="KANA", bold="KANA-Bd", italic="KANA-It")
    return quelle


# ── Absatzformate ─────────────────────────────────────────────────────────
def formate():
    """Groessenleiter aus dem Handoff, auf A4 heruntergerechnet.

    Der Handoff beschreibt Bildschirmgroessen (88/56/44/30/22/19/17/15/14/13).
    Auf A4 gilt dasselbe Verhaeltnis bei kleinerem Grundwert. Die Laufweiten
    sind uebernommen: Ueberschriften laufen eng, Mono-Labels weit.
    """
    f = {}
    f["fliess"] = ParagraphStyle("fliess", fontName="KANA", fontSize=9.5, leading=16,
                                 textColor=TEXT, spaceAfter=3.4 * mm, alignment=TA_LEFT)

    f["h1"] = ParagraphStyle("h1", parent=f["fliess"], fontName="KANA-Display", fontSize=19,
                             leading=23, textColor=TEXT, charSpace=-0.55,
                             spaceBefore=0, spaceAfter=4 * mm)
    f["h2"] = ParagraphStyle("h2", parent=f["fliess"], fontName="KANA-H", fontSize=13,
                             leading=17, textColor=TEXT, charSpace=-0.35,
                             spaceBefore=7 * mm, spaceAfter=2.5 * mm)
    f["h3"] = ParagraphStyle("h3", parent=f["fliess"], fontName="KANA-Bd", fontSize=10.5,
                             leading=14, textColor=AKZENT, charSpace=-0.15,
                             spaceBefore=5 * mm, spaceAfter=1.8 * mm)
    f["h4"] = ParagraphStyle("h4", parent=f["fliess"], fontName="KANA-Bd", fontSize=9.5,
                             textColor=TEXT_WEICH, spaceBefore=3 * mm, spaceAfter=1.2 * mm)

    f["liste"] = ParagraphStyle("liste", parent=f["fliess"], leftIndent=5 * mm,
                                bulletIndent=1.5 * mm, spaceAfter=1.3 * mm)
    f["liste_eng"] = ParagraphStyle("liste_eng", parent=f["fliess"], spaceAfter=0)
    f["code"] = ParagraphStyle("code", parent=f["fliess"], fontName="KANA-Mono", fontSize=8,
                               leading=12, textColor=TEXT, backColor=FLAECHE_TIEF,
                               borderColor=HAIRLINE, borderWidth=0.5, borderPadding=5,
                               spaceBefore=2 * mm, spaceAfter=4 * mm)
    f["zitat"] = ParagraphStyle("zitat", parent=f["fliess"], leftIndent=5 * mm,
                                textColor=TEXT_TERTIAER)

    # Titelflaeche (aus ASCII-Kaesten der Quelle)
    f["titelflaeche_1"] = ParagraphStyle("tf1", parent=f["fliess"], fontName="KANA-H",
                                         fontSize=14, leading=18, textColor=TEXT,
                                         charSpace=-0.35, spaceAfter=1.4 * mm)
    f["titelflaeche_2"] = ParagraphStyle("tf2", parent=f["fliess"], fontName="KANA-Mono",
                                         fontSize=7.5, textColor=AKZENT, charSpace=0.9,
                                         spaceAfter=0)

    f["tab"] = ParagraphStyle("tab", parent=f["fliess"], fontSize=8.5, leading=12.5, spaceAfter=0)
    # Zahlen, Kennwerte und Zeitangaben laufen in der Mono — Handoff-Rolle
    # "Zahlen, Labels, Zeitstempel". In Tabellen richtet das die Spalten aus.
    f["tab_zahl"] = ParagraphStyle("tabz", parent=f["tab"], fontName="KANA-Mono", fontSize=8)
    f["tab_kopf"] = ParagraphStyle("tabk", parent=f["tab"], fontName="KANA-Mono", fontSize=7.5,
                                   textColor=TEXT_WEICH, charSpace=0.9)
    return f


def mono_label(text):
    """Mono-Rubrik: Versalien, weite Laufweite. Handoff-Rolle 'Mono-Label'."""
    return text.upper()


# ── Inline-Auszeichnung ───────────────────────────────────────────────────
def inline(text):
    """Markdown-Inline nach reportlab-Markup. Der Wortlaut bleibt unveraendert —
    es kommt nur Auszeichnung darum."""
    t = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    t = re.sub(r"`([^`]+)`", r'<font face="KANA-Mono" size="8.5">\1</font>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)",
               r'<link href="\2" color="' + HEX_AKZENT + r'">\1</link>', t)

    # Belegkette sichtbar machen — Text bleibt Wort fuer Wort erhalten
    t = re.sub(r"(\[ANALYST:[^\]]*\])",
               r'<font color="' + HEX_AKZENT + r'" face="KANA-Bd">\1</font>', t)
    t = re.sub(r"(\[ABGELEITET[^\]]*\])",
               r'<font color="' + HEX_STUMM + r'" face="KANA-Mono" size="8">\1</font>', t)
    t = t.replace("Orientierungsbeispiel — kein finaler Text",
                  '<font color="' + HEX_STUMM + '"><i>Orientierungsbeispiel — kein finaler Text</i></font>')
    return t


class Punkt(Flowable):
    """Listenzeichen der Checkliste, gezeichnet statt gesetzt.

    Die Legende des Portals uebertragen: gefuellter Punkt = erledigt,
    hohler Punkt = offen. Gezeichnet, weil die CI-Schriften ☐ und ☑ zwar im
    cmap fuehren, aber als leere Kaesten setzen — das faellt erst im fertigen
    PDF auf. Ein Kreis aus zwei Zahlen kann nicht fehlschlagen.
    """

    def __init__(self, erledigt, d=3.0 * mm):
        Flowable.__init__(self)
        self.erledigt = erledigt
        self.width = self.height = d

    def draw(self):
        c = self.canv
        r = self.width / 2.0
        if self.erledigt:
            c.setFillColor(AKZENT)
            c.circle(r, r, r * 0.72, stroke=0, fill=1)
        else:
            c.setStrokeColor(AKZENT_RAND)
            c.setLineWidth(0.7)
            c.circle(r, r, r * 0.72, stroke=1, fill=0)


RAHMEN = set("═║╔╗╚╝─━┌┐└┘│┃")


def ist_rahmenzeile(z):
    kern = z.strip()
    if not kern:
        return False
    return sum(c in RAHMEN for c in kern) / len(kern) > 0.5


# ── Markdown lesen ────────────────────────────────────────────────────────
def bauen(md, f):
    fluss = []
    zeilen = md.split("\n")
    i = 0
    titel, untertitel = None, None

    while i < len(zeilen):
        z = zeilen[i]
        s = z.strip()

        # Codeblock
        if s.startswith("```"):
            i += 1
            block = []
            while i < len(zeilen) and not zeilen[i].strip().startswith("```"):
                block.append(zeilen[i])
                i += 1
            i += 1
            # Reine ASCII-Kaesten werden zur Titelflaeche, kein Codeblock
            inhalt = [b for b in block if b.strip() and not ist_rahmenzeile(b)]
            if block and all(ist_rahmenzeile(b) or any(c in RAHMEN for c in b) for b in block if b.strip()):
                texte = [re.sub(r"[" + "".join(RAHMEN) + r"]", "", b).strip() for b in inhalt]
                texte = [t for t in texte if t]
                if texte:
                    fluss.append(titelflaeche(texte, f))
                    if titel is None and texte:
                        titel = texte[0]
                        untertitel = texte[1] if len(texte) > 1 else None
                continue
            if block:
                fluss.append(Paragraph("<br/>".join(
                    inline(b) or "&nbsp;" for b in block), f["code"]))
            continue

        # ASCII-Kasten ohne Codefence
        if ist_rahmenzeile(z) and i + 1 < len(zeilen):
            block = []
            while i < len(zeilen) and (ist_rahmenzeile(zeilen[i]) or
                                       any(c in RAHMEN for c in zeilen[i])):
                block.append(zeilen[i])
                i += 1
            texte = [re.sub(r"[" + "".join(RAHMEN) + r"]", "", b).strip() for b in block]
            texte = [t for t in texte if t]
            if texte:
                fluss.append(titelflaeche(texte, f))
                if titel is None:
                    titel = texte[0]
                    untertitel = texte[1] if len(texte) > 1 else None
            continue

        # Tabelle
        if s.startswith("|") and i + 1 < len(zeilen) and re.match(r"^\|[\s:|-]+\|$", zeilen[i + 1].strip()):
            reihen = []
            while i < len(zeilen) and zeilen[i].strip().startswith("|"):
                reihen.append([c.strip() for c in zeilen[i].strip().strip("|").split("|")])
                i += 1
            if len(reihen) >= 2:
                del reihen[1]
                fluss.append(tabelle(reihen, f))
            continue

        # Trennlinie
        if re.match(r"^(-{3,}|_{3,}|\*{3,})$", s):
            i += 1
            continue

        # Ueberschriften
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            stufe, txt = len(m.group(1)), m.group(2)
            if stufe == 1:
                if titel is None:
                    titel = txt
                if fluss:
                    fluss.append(PageBreak())
                fluss.append(Paragraph(inline(txt), f["h1"]))
                fluss.append(akzentlinie())
            elif stufe == 2:
                if untertitel is None and titel and not any(
                        isinstance(x, Paragraph) for x in fluss[-3:] if hasattr(x, "style")):
                    untertitel = txt
                fluss.append(Paragraph(inline(txt), f["h2"]))
            else:
                fluss.append(Paragraph(inline(txt), f["h" + str(min(stufe, 4))]))
            i += 1
            continue

        # Checkliste — aufeinanderfolgende Punkte werden EIN Block, damit die
        # Zeichen buendig stehen und die Liste nicht ueber Seiten reisst.
        if re.match(r"^[-*+]\s+\[[ xX]\]\s+", s):
            punkte = []
            while i < len(zeilen):
                m = re.match(r"^[-*+]\s+\[([ xX])\]\s+(.*)$", zeilen[i].strip())
                if not m:
                    break
                punkte.append((m.group(1).lower() == "x", m.group(2)))
                i += 1
            fluss.append(checkliste(punkte, f))
            continue
        m = re.match(r"^[-*+]\s+(.*)$", s)
        if m:
            fluss.append(Paragraph(inline(m.group(1)), f["liste"], bulletText="•"))
            i += 1
            continue
        m = re.match(r"^(\d+)\.\s+(.*)$", s)
        if m:
            fluss.append(Paragraph(inline(m.group(2)), f["liste"], bulletText=m.group(1) + "."))
            i += 1
            continue

        # Zitat — mehrzeilige Blockzitate gehoeren in EINEN Rahmen, nicht in
        # einen je Zeile.
        if s.startswith(">"):
            teile = []
            while i < len(zeilen) and zeilen[i].strip().startswith(">"):
                teile.append(zeilen[i].strip().lstrip("> ").strip())
                i += 1
            absaetze = []
            lauf = []
            for teil in teile:
                if teil:
                    lauf.append(teil)
                elif lauf:
                    absaetze.append(" ".join(lauf))
                    lauf = []
            if lauf:
                absaetze.append(" ".join(lauf))
            if absaetze:
                fluss.append(zitat(absaetze, f))
            continue

        # Absatz
        if s:
            absatz = [s]
            i += 1
            while i < len(zeilen) and zeilen[i].strip() and not re.match(
                    r"^(#{1,4}\s|[-*+]\s|\d+\.\s|\||>|```)", zeilen[i].strip()) \
                    and not ist_rahmenzeile(zeilen[i]):
                absatz.append(zeilen[i].strip())
                i += 1
            fluss.append(Paragraph(inline(" ".join(absatz)), f["fliess"]))
            continue

        i += 1

    return fluss, titel, untertitel


# ── Bausteine ─────────────────────────────────────────────────────────────
def akzentlinie():
    """Kapitellinie. Duenn — der Handoff kennt Hairlines, keine Balken."""
    t = Table([[""]], colWidths=[A4[0] - 2 * RAND], rowHeights=[1.2])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), AKZENT),
                           ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return KeepTogether([t, Spacer(1, 4 * mm)])


def titelflaeche(texte, f):
    """Kasten aus der Quelle. Petrol-Kante links, getoente Flaeche, kein Radius."""
    inhalt = [Paragraph(inline(texte[0]), f["titelflaeche_1"])]
    for weiterer in texte[1:]:
        inhalt.append(Paragraph(inline(mono_label(weiterer)), f["titelflaeche_2"]))
    t = Table([[inhalt]], colWidths=[A4[0] - 2 * RAND])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FLAECHE),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, AKZENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 6 * mm)])


def zitat(absaetze, f):
    """Zitat mit Petrol-Hairline links statt Einzug allein."""
    inhalt = [Paragraph(inline(a), f["zitat"]) for a in absaetze]
    t = Table([[inhalt]], colWidths=[A4[0] - 2 * RAND])
    t.setStyle(TableStyle([
        ("LINEBEFORE", (0, 0), (0, -1), 1, AKZENT_RAND),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 3 * mm)])


def checkliste(punkte, f):
    """Checkliste als zweispaltige Tabelle: gezeichnetes Zeichen, dann Text."""
    breite = A4[0] - 2 * RAND
    spalte = 7 * mm
    daten = [[Punkt(erledigt), Paragraph(inline(text), f["liste_eng"])]
             for erledigt, text in punkte]
    t = Table(daten, colWidths=[spalte, breite - spalte])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 2 * mm),
        ("LEFTPADDING", (1, 0), (1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        # Das Zeichen sitzt tiefer als die Oberkante der Zeile, damit es auf
        # der Mitte der ersten Textzeile steht statt darueber.
        ("TOPPADDING", (0, 0), (0, -1), 1.9 * mm),
        ("TOPPADDING", (1, 0), (1, -1), 0.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 2.5 * mm)])


def ist_zahl(zelle):
    """Zellen, die nur aus Zahl, Vorzeichen, Einheit oder Bruch bestehen."""
    return bool(re.fullmatch(r"[\d\s.,:/%+\u2212\u2013-]*\d[\d\s.,:/%+\u2212\u2013-]*", zelle.strip()))


def tabelle(reihen, f):
    """Kopf als Mono-Label auf getoenter Flaeche, Zeilen durch Hairlines getrennt."""
    breite = A4[0] - 2 * RAND
    spalten = max(len(r) for r in reihen)
    daten = []
    for nr, reihe in enumerate(reihen):
        reihe = reihe + [""] * (spalten - len(reihe))
        if nr == 0:
            daten.append([Paragraph(inline(mono_label(c)), f["tab_kopf"]) for c in reihe])
        else:
            daten.append([Paragraph(inline(c), f["tab_zahl"] if ist_zahl(c) else f["tab"])
                          for c in reihe])
    t = Table(daten, colWidths=[breite / spalten] * spalten, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FLAECHE_TIEF),
        ("LINEBELOW", (0, 0), (-1, 0), 1, AKZENT),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, HAIRLINE_SOFT),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, HAIRLINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 5 * mm)])


# ── Signet und Orbital ────────────────────────────────────────────────────
def signet(c, x, y, groesse, farbe=AKZENT, ring=True):
    """Das Zeichen: offener Bogen, Innenring, Kern. Drei Kreise, kein SVG.

    x, y ist der Mittelpunkt. Der Bogen laeuft ueber 270 Grad, die Oeffnung
    liegt rechts — so steht der sichtbare Bogen links neben dem Kern.
    Verhaeltnis nach Handoff: Bogen 120, Innenring 72, Kern 34.
    Unter 20 px bzw. hier unter 7 mm faellt der Innenring weg.
    """
    r = groesse / 2.0
    c.saveState()
    c.setStrokeColor(farbe)
    c.setLineWidth(max(0.7, groesse * 0.016))
    c.setLineCap(1)
    c.arc(x - r, y - r, x + r, y + r, startAng=45, extent=270)

    if ring and groesse >= 7 * mm:
        ri = r * 0.60
        c.setStrokeColor(ueber(colors.HexColor("#14181A"), 0.20, FLAECHE))
        c.setLineWidth(max(0.4, groesse * 0.008))
        c.circle(x, y, ri, stroke=1, fill=0)

    c.setFillColor(farbe)
    c.circle(x, y, r * 0.28, stroke=0, fill=1)
    c.restoreState()


def orbital(c, x, y, r_aussen, deckkraft=0.5):
    """Dekoratives Lagebild fuer das Deckblatt.

    Kern, erste Bahn (Abteilungen), zweite Bahn (Agents), Speichen dazwischen.
    Winkel der vier Abteilungen wie im Handoff: Marketing oben, Vertrieb
    rechts, IT unten, Content links. Rein dekorativ, keine Beschriftung —
    auf dem Deckblatt traegt das Motiv, nicht die Information.
    """
    r_innen = r_aussen * 0.59
    r_kern = r_aussen * 0.155
    r_knoten = r_aussen * 0.036
    linie = ueber(AKZENT, 0.45 * deckkraft, FLAECHE)
    zart = ueber(colors.HexColor("#14181A"), 0.16 * deckkraft, FLAECHE)
    petrol = ueber(AKZENT, deckkraft, FLAECHE)

    c.saveState()

    # Zweite Bahn als zarter Kreis, erste Bahn ebenso
    c.setStrokeColor(zart)
    c.setLineWidth(0.5)
    c.circle(x, y, r_aussen, stroke=1, fill=0)
    c.circle(x, y, r_innen, stroke=1, fill=0)

    # Abteilungen: Marketing -90, Vertrieb 0, IT 90, Content 180 (CSS-Zaehlung,
    # y nach unten). Im PDF zeigt y nach oben, darum das Vorzeichen drehen.
    for winkel_css, spread in ((-90, 46), (0, 46), (90, 46), (180, 46)):
        a = math.radians(-winkel_css)
        ax, ay = x + r_innen * math.cos(a), y + r_innen * math.sin(a)

        # Speiche laeuft von der Kante des Kerns bis zur Kante des Knotens,
        # nicht durch beide hindurch.
        c.setStrokeColor(linie)
        c.setLineWidth(1.2)
        c.line(x + (r_kern + 0.6) * math.cos(a), y + (r_kern + 0.6) * math.sin(a),
               x + (r_innen - r_knoten) * math.cos(a), y + (r_innen - r_knoten) * math.sin(a))

        # Vier Agents je Abteilung, gestreut um den Abteilungswinkel. Die
        # Linie beginnt am Rand des Abteilungsknotens, damit sie nicht durch
        # ihn hindurchlaeuft.
        for k in range(4):
            versatz = -spread / 2 + spread * k / 3.0
            b = math.radians(-(winkel_css + versatz))
            gx, gy = x + r_aussen * math.cos(b), y + r_aussen * math.sin(b)
            laenge = math.hypot(gx - ax, gy - ay)
            if laenge > r_knoten:
                sx = ax + (gx - ax) / laenge * r_knoten
                sy = ay + (gy - ay) / laenge * r_knoten
                c.setStrokeColor(zart)
                c.setLineWidth(0.5)
                c.line(sx, sy, gx, gy)
            c.setFillColor(linie)
            c.circle(gx, gy, r_aussen * 0.019, stroke=0, fill=1)

        # Knoten zuletzt, damit er ueber den Linienenden liegt
        c.setFillColor(petrol)
        c.circle(ax, ay, r_knoten, stroke=0, fill=1)

    # Offener Bogen aussen und Kern
    c.setStrokeColor(petrol)
    c.setLineWidth(1.6)
    c.setLineCap(1)
    ra = r_aussen * 1.18
    c.arc(x - ra, y - ra, x + ra, y + ra, startAng=45, extent=270)

    c.setFillColor(petrol)
    c.circle(x, y, r_kern, stroke=0, fill=1)
    c.restoreState()


def wortmarke(c, x, y, groesse=12):
    """KANA in Textfarbe, AI in Petrol. Archivo 800, eng laufend."""
    c.saveState()
    c.setFont("KANA-Display", groesse)
    c.setFillColor(TEXT)
    c.drawString(x, y, "KANA")
    breite = pdfmetrics.stringWidth("KANA", "KANA-Display", groesse)
    c.setFillColor(AKZENT)
    c.drawString(x + breite + groesse * 0.26, y, "AI")
    c.restoreState()


# ── Seitenrahmen ──────────────────────────────────────────────────────────
def deckblatt_zeichnen(c, doc, titel, untertitel):
    b, h = A4
    c.saveState()

    # Helle Flaeche, wie das Hero-Band der Landingpage
    c.setFillColor(FLAECHE)
    c.rect(0, 0, b, h, stroke=0, fill=1)

    # Orbital als Hintergrundmotiv, rechts angeschnitten wie im Hero
    orbital(c, b * 0.71, h * 0.555, 54 * mm, deckkraft=0.38)

    x = 24 * mm

    # Kopf: Signet und Wortmarke
    signet(c, x + 3.2 * mm, h - 42 * mm, 6.4 * mm)
    wortmarke(c, x + 9 * mm, h - 43.6 * mm, 12)

    # Titel
    c.setFillColor(TEXT)
    c.setFont("KANA-Display", 27)
    y = h - 118 * mm
    for zeile in umbrechen(titel or "Bericht", "KANA-Display", 27, (b - 2 * x) * 0.66):
        c.drawString(x, y, zeile)
        y -= 11 * mm

    if untertitel:
        c.setFillColor(TEXT_WEICH)
        c.setFont("KANA", 12)
        y -= 4 * mm
        for zeile in umbrechen(untertitel, "KANA", 12, (b - 2 * x) * 0.66):
            c.drawString(x, y, zeile)
            y -= 6 * mm

    # Petrol-Strich statt Balken mit Radius — der Handoff kennt keinen Radius
    c.setFillColor(AKZENT)
    c.rect(x, y - 12 * mm, 54 * mm, 2, stroke=0, fill=1)

    # Fusszeile
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.5)
    c.line(x, 32 * mm, b - x, 32 * mm)
    c.setFillColor(TEXT_STUMM)
    c.setFont("KANA-Mono", 7.5)
    c.drawString(x, 26 * mm, "KANA AI — DIGITALE MITARBEITER ON DEMAND")
    c.restoreState()


def inhalt_zeichnen(c, doc):
    b, _ = A4
    c.saveState()
    c.setFillColor(SEITE)
    c.rect(0, 0, b, A4[1], stroke=0, fill=1)

    # Kleines Zeichen in der Fusszeile statt Wortmarke allein
    signet(c, RAND + 1.6 * mm, 12.6 * mm, 3.2 * mm, ring=False)
    c.setFillColor(TEXT_STUMM)
    c.setFont("KANA-Mono", 7)
    c.drawString(RAND + 5.4 * mm, 12 * mm, "KANA AI")
    c.drawRightString(b - RAND, 12 * mm, str(doc.page - 1))

    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.4)
    c.line(RAND, 15.5 * mm, b - RAND, 15.5 * mm)
    c.restoreState()


def umbrechen(text, schrift, groesse, breite):
    worte, zeilen, aktuell = text.split(), [], ""
    for w in worte:
        probe = (aktuell + " " + w).strip()
        if pdfmetrics.stringWidth(probe, schrift, groesse) <= breite:
            aktuell = probe
        else:
            if aktuell:
                zeilen.append(aktuell)
            aktuell = w
    if aktuell:
        zeilen.append(aktuell)
    return zeilen


def erzeugen(md_pfad, pdf_pfad):
    quelle_schrift = schriften_registrieren()
    f = formate()
    md = Path(md_pfad).read_text(encoding="utf-8")
    fluss, titel, untertitel = bauen(md, f)

    # Art. 50 Abs. 2 KI-VO verlangt eine MASCHINENLESBARE Markierung der
    # erzeugten Inhalte — ein sichtbarer Hinweis auf der Seite genuegt nicht.
    # Die PDF-Metadaten sind der Ort, an dem ein Pruefwerkzeug sie findet.
    # (Vollstaendig ist das noch nicht: fuer Bilder, Videos und kopierte
    #  Chat-Texte fehlt eine entsprechende Markierung.
    #  Siehe docs/ki-verordnung-offene-punkte.md.)
    doc = BaseDocTemplate(str(pdf_pfad), pagesize=A4,
                          leftMargin=RAND, rightMargin=RAND,
                          topMargin=18 * mm, bottomMargin=20 * mm,
                          title=titel or "KANA AI", author="KANA AI",
                          creator="KANA AI — KI-generiert (AI-generated)",
                          subject="Von einem KI-System erzeugter Inhalt. "
                                  "Kann Fehler enthalten, vor Verwendung pruefen. "
                                  "Kennzeichnung nach Art. 50 Abs. 2 VO (EU) 2024/1689.")

    leer = Frame(0, 0, A4[0], A4[1], id="deck",
                 leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    inhalt = Frame(RAND, 20 * mm, A4[0] - 2 * RAND, A4[1] - 38 * mm, id="inhalt",
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)

    doc.addPageTemplates([
        PageTemplate(id="Deckblatt", frames=[leer],
                     onPage=lambda c, d: deckblatt_zeichnen(c, d, titel, untertitel)),
        PageTemplate(id="Inhalt", frames=[inhalt], onPage=inhalt_zeichnen),
    ])

    doc.build([NextPageTemplate("Inhalt"), PageBreak()] + fluss)

    groesse = Path(pdf_pfad).stat().st_size
    print(f"PDF: {pdf_pfad}")
    print(f"Seiten: {doc.page}")
    print(f"Groesse: {groesse} Bytes")
    print(f"Schrift: {quelle_schrift}")
    print(f"Titel: {titel}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Aufruf: python3 kana_pdf.py <quelle.md> <ziel.pdf>", file=sys.stderr)
        sys.exit(1)
    erzeugen(sys.argv[1], sys.argv[2])
