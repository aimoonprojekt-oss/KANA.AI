#!/usr/bin/env python3
"""
KANA AI — Markdown nach PDF im Corporate Design.

    python3 kana_pdf.py <quelle.md> <ziel.pdf>

Warum ein Skript und keine Beschreibung im Prompt:
Layout ist Rechnung, keine Einschaetzung. Ein beschriebenes Layout wird bei
jedem Lauf ein wenig anders. Dieses Skript erzeugt aus derselben Quelle immer
dasselbe Dokument — und kostet dabei fast nichts, weil der Agent den Text
nicht durch das Modell schicken muss.

Farben und Schrift stammen aus app/globals.css der Plattform.
Deckblatt dunkel wie die Website, Inhalt hell — ein mehrseitiges dunkles PDF
ist am Bildschirm ermuedend und beim Ausdrucken unbrauchbar.
"""

import re
import sys
import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, PageBreak, KeepTogether, NextPageTemplate,
)

# ── Farben (aus app/globals.css) ──────────────────────────────────────────
AKZENT       = colors.HexColor("#6366F1")
AKZENT_HELL  = colors.HexColor("#818CF8")
DUNKEL       = colors.HexColor("#060A13")
TINT         = colors.HexColor("#F4F5FF")
TEXT         = colors.HexColor("#16202F")
TEXT_WEICH   = colors.HexColor("#4A5A6E")
TEXT_STUMM   = colors.HexColor("#7A8FA6")
LINIE        = colors.HexColor("#E2E8F0")
WEISS_WARM   = colors.HexColor("#F1F5F9")

RAND = 20 * mm


# ── Schriften ─────────────────────────────────────────────────────────────
def schriften_registrieren():
    """Inter, wenn im Skill mitgeliefert. Sonst DejaVu (voller Unicode-Satz).

    NICHT die eingebauten reportlab-Schriften nehmen: denen fehlen Zeichen wie
    ☐ • ◦ — sie werden dann still durch ASCII ersetzt oder als Kasten gesetzt.
    """
    hier = Path(__file__).resolve().parent
    inter = {
        "KANA":      ["Inter-Regular.ttf",  "Inter_18pt-Regular.ttf"],
        "KANA-Bd":   ["Inter-SemiBold.ttf", "Inter_18pt-SemiBold.ttf"],
        "KANA-Blk":  ["Inter-Black.ttf",    "Inter_18pt-Black.ttf"],
        "KANA-It":   ["Inter-Italic.ttf",   "Inter_18pt-Italic.ttf"],
    }
    gefunden = True
    for name, kandidaten in inter.items():
        pfad = next((hier / k for k in kandidaten if (hier / k).exists()), None)
        if pfad is None:
            gefunden = False
            break
        pdfmetrics.registerFont(TTFont(name, str(pfad)))

    if gefunden:
        quelle = "Inter"
    else:
        d = "/usr/share/fonts/truetype/dejavu"
        paare = [("KANA", "DejaVuSans.ttf"), ("KANA-Bd", "DejaVuSans-Bold.ttf"),
                 ("KANA-Blk", "DejaVuSans-Bold.ttf"), ("KANA-It", "DejaVuSans-Oblique.ttf")]
        for name, datei in paare:
            pdfmetrics.registerFont(TTFont(name, os.path.join(d, datei)))
        quelle = "DejaVu Sans (Inter nicht im Skill gefunden)"

    pdfmetrics.registerFont(TTFont("KANA-Mono", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"))
    pdfmetrics.registerFontFamily("KANA", normal="KANA", bold="KANA-Bd", italic="KANA-It")
    return quelle


# ── Absatzformate ─────────────────────────────────────────────────────────
def formate():
    f = {}
    f["fliess"] = ParagraphStyle("fliess", fontName="KANA", fontSize=9.5, leading=15,
                                 textColor=TEXT, spaceAfter=3.4 * mm, alignment=TA_LEFT)
    f["h1"] = ParagraphStyle("h1", parent=f["fliess"], fontName="KANA-Blk", fontSize=17,
                             leading=21, textColor=TEXT, spaceBefore=0, spaceAfter=4 * mm)
    f["h2"] = ParagraphStyle("h2", parent=f["fliess"], fontName="KANA-Bd", fontSize=12.5,
                             leading=16, textColor=TEXT, spaceBefore=7 * mm, spaceAfter=2.5 * mm)
    f["h3"] = ParagraphStyle("h3", parent=f["fliess"], fontName="KANA-Bd", fontSize=10.5,
                             leading=14, textColor=AKZENT, spaceBefore=5 * mm, spaceAfter=1.8 * mm)
    f["h4"] = ParagraphStyle("h4", parent=f["fliess"], fontName="KANA-Bd", fontSize=9.5,
                             textColor=TEXT_WEICH, spaceBefore=3 * mm, spaceAfter=1.2 * mm)
    f["liste"] = ParagraphStyle("liste", parent=f["fliess"], leftIndent=5 * mm,
                                bulletIndent=1.5 * mm, spaceAfter=1.3 * mm)
    f["code"] = ParagraphStyle("code", parent=f["fliess"], fontName="KANA-Mono", fontSize=8,
                               leading=11, textColor=TEXT, backColor=colors.HexColor("#F7F9FC"),
                               borderColor=LINIE, borderWidth=0.5, borderPadding=4,
                               spaceBefore=2 * mm, spaceAfter=4 * mm)
    f["titelflaeche_1"] = ParagraphStyle("tf1", parent=f["fliess"], fontName="KANA-Blk",
                                         fontSize=14, leading=18, textColor=TEXT, spaceAfter=1 * mm)
    f["titelflaeche_2"] = ParagraphStyle("tf2", parent=f["fliess"], fontName="KANA-Bd",
                                         fontSize=9.5, textColor=AKZENT, spaceAfter=0)
    f["tab"] = ParagraphStyle("tab", parent=f["fliess"], fontSize=8.5, leading=12, spaceAfter=0)
    f["tab_kopf"] = ParagraphStyle("tabk", parent=f["tab"], fontName="KANA-Bd")
    # Deckblatt
    f["dw"] = ParagraphStyle("dw", fontName="KANA-Blk", fontSize=14, textColor=WEISS_WARM, leading=18)
    f["dt"] = ParagraphStyle("dt", fontName="KANA-Blk", fontSize=27, textColor=WEISS_WARM,
                             leading=33, spaceBefore=60 * mm)
    f["du"] = ParagraphStyle("du", fontName="KANA", fontSize=12, textColor=colors.HexColor("#B8C5D6"),
                             leading=17, spaceBefore=6 * mm)
    return f


# ── Inline-Auszeichnung ───────────────────────────────────────────────────
def inline(text):
    """Markdown-Inline nach reportlab-Markup. Der Wortlaut bleibt unveraendert —
    es kommt nur Auszeichnung darum."""
    t = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    t = re.sub(r"`([^`]+)`", r'<font face="KANA-Mono" size="8.5">\1</font>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<link href="\2" color="#6366F1">\1</link>', t)

    # Belegkette sichtbar machen — Text bleibt Wort fuer Wort erhalten
    t = re.sub(r"(\[ANALYST:[^\]]*\])",
               r'<font color="#6366F1" face="KANA-Bd">\1</font>', t)
    t = re.sub(r"(\[ABGELEITET[^\]]*\])",
               r'<font color="#7A8FA6" face="KANA-Bd">\1</font>', t)
    t = t.replace("Orientierungsbeispiel — kein finaler Text",
                  '<font color="#7A8FA6"><i>Orientierungsbeispiel — kein finaler Text</i></font>')
    return t


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

        # Listen
        m = re.match(r"^[-*+]\s+\[([ xX])\]\s+(.*)$", s)
        if m:
            zeichen = "☑" if m.group(1).lower() == "x" else "☐"
            fluss.append(Paragraph(inline(m.group(2)), f["liste"], bulletText=zeichen))
            i += 1
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

        # Zitat
        if s.startswith(">"):
            fluss.append(Paragraph(inline(s.lstrip("> ").strip()),
                                   ParagraphStyle("z", parent=f["fliess"], leftIndent=5 * mm,
                                                  textColor=TEXT_WEICH)))
            i += 1
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


def akzentlinie():
    t = Table([[""]], colWidths=[A4[0] - 2 * RAND], rowHeights=[1.6])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), AKZENT),
                           ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return KeepTogether([t, Spacer(1, 4 * mm)])


def titelflaeche(texte, f):
    inhalt = [Paragraph(inline(texte[0]), f["titelflaeche_1"])]
    for weiterer in texte[1:]:
        inhalt.append(Paragraph(inline(weiterer), f["titelflaeche_2"]))
    t = Table([[inhalt]], colWidths=[A4[0] - 2 * RAND])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TINT),
        ("LINEBEFORE", (0, 0), (0, -1), 3, AKZENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 6 * mm)])


def tabelle(reihen, f):
    breite = A4[0] - 2 * RAND
    spalten = max(len(r) for r in reihen)
    daten = []
    for nr, reihe in enumerate(reihen):
        reihe = reihe + [""] * (spalten - len(reihe))
        stil = f["tab_kopf"] if nr == 0 else f["tab"]
        daten.append([Paragraph(inline(c), stil) for c in reihe])
    t = Table(daten, colWidths=[breite / spalten] * spalten, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TINT),
        ("LINEBELOW", (0, 0), (-1, 0), 1.4, AKZENT),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINIE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
    ]))
    return KeepTogether([t, Spacer(1, 5 * mm)])


# ── Seitenrahmen ──────────────────────────────────────────────────────────
def deckblatt_zeichnen(c, doc, titel, untertitel):
    b, h = A4
    c.saveState()
    c.setFillColor(DUNKEL)
    c.rect(0, 0, b, h, stroke=0, fill=1)
    x = 24 * mm

    c.setFillColor(AKZENT)
    c.circle(x + 2.2 * mm, h - 42 * mm, 2.2 * mm, stroke=0, fill=1)
    c.setFillColor(WEISS_WARM)
    c.setFont("KANA-Blk", 14)
    c.drawString(x + 8 * mm, h - 43.5 * mm, "KANA AI")

    c.setFont("KANA-Blk", 27)
    y = h - 115 * mm
    for zeile in umbrechen(titel or "Bericht", "KANA-Blk", 27, b - 2 * x):
        c.drawString(x, y, zeile)
        y -= 11 * mm

    if untertitel:
        c.setFillColor(colors.HexColor("#B8C5D6"))
        c.setFont("KANA", 12)
        y -= 4 * mm
        for zeile in umbrechen(untertitel, "KANA", 12, b - 2 * x):
            c.drawString(x, y, zeile)
            y -= 6 * mm

    c.setFillColor(AKZENT)
    c.roundRect(x, y - 12 * mm, 54 * mm, 3, 1.5, stroke=0, fill=1)

    c.setStrokeColor(colors.HexColor("#1E2A3D"))
    c.setLineWidth(0.6)
    c.line(x, 32 * mm, b - x, 32 * mm)
    c.setFillColor(TEXT_STUMM)
    c.setFont("KANA", 8.5)
    c.drawString(x, 26 * mm, "KANA AI — Digitale Mitarbeiter on Demand")
    c.restoreState()


def inhalt_zeichnen(c, doc):
    b, _ = A4
    c.saveState()
    c.setFillColor(TEXT_STUMM)
    c.setFont("KANA-Bd", 8)
    c.drawString(RAND, 12 * mm, "KANA AI")
    c.setFont("KANA", 8)
    c.drawRightString(b - RAND, 12 * mm, str(doc.page - 1))
    c.setStrokeColor(LINIE)
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

    doc = BaseDocTemplate(str(pdf_pfad), pagesize=A4,
                          leftMargin=RAND, rightMargin=RAND,
                          topMargin=18 * mm, bottomMargin=20 * mm,
                          title=titel or "KANA AI", author="KANA AI")

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
