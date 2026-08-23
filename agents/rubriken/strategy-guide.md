# Rubrik — Ad Strategy Guide

Gilt für den Creative Strategist. Jedes Kriterium wird einzeln bewertet, darum
ist jedes einzeln pruefbar formuliert. Keine Geschmacksfragen.

`<N>` ist die im AUFTRAG genannte Brief-Anzahl, `<VERTEILUNG>` die dort
festgelegte Verteilung auf die Stages.

## Lieferung

1. Die Datei `/mnt/session/outputs/strategy-guide.md` existiert und ist
   groesser als 8000 Bytes.
2. Die Datei `/mnt/session/outputs/strategy-guide.pdf` existiert und ist
   groesser als 20000 Bytes.
3. Die erste Zeilengruppe der Markdown-Datei ist die Kastengrafik aus
   `╔ ═ ║ ╚` und enthaelt die Kopfzeile aus dem AUFTRAG woertlich.

## Vollstaendigkeit

4. Der Guide enthaelt genau `<N>` Brief-Bloecke — nicht mehr, nicht weniger.
   Gezaehlt werden Zeilen, die mit `[IMAGE BRIEF` oder `[VIDEO BRIEF` beginnen.
5. Die Verteilung der Briefs auf die Stages entspricht `<VERTEILUNG>` exakt.
6. Jede im AUFTRAG genannte Stage hat einen eigenen Abschnitt mit
   `─── STAGE [N] — [NAME] ───`.
7. Jeder Stage-Abschnitt enthaelt die Blöcke `MARKET EVIDENCE:` und
   `LANDING PAGE EMPFEHLUNG:`.
8. Der Guide endet mit `─── BRAND-REGELN FÜR SCRIPT WRITER ───` und
   `─── SCRIPT WRITER CHECKLISTE ───`.

## Belegkette

9. Jeder `MARKET EVIDENCE:`-Block enthaelt entweder mindestens eine
   `[ANALYST: ...]`-Markierung mit Advertiser und Score, oder woertlich
   "Blue Ocean Opportunity". Ein Block ohne beides ist ein Mangel.
10. Jede `[ANALYST: ...]`-Markierung nennt einen Advertiser, der in
    `analyst-ergebnisse.json` tatsaechlich vorkommt. Erfundene Advertiser
    sind ein Mangel.
11. Jeder Score in einer `[ANALYST: ...]`-Markierung stimmt mit dem Score
    desselben Advertisers in `analyst-ergebnisse.json` ueberein.
12. Aussagen, die weder aus Brand Knowledge noch aus Analyst-Ergebnissen
    stammen, sind mit `[ABGELEITET]` markiert.
13. Jedes Copy-Beispiel traegt den Zusatz
    "Orientierungsbeispiel — kein finaler Text".

## Markenkonformitaet

14. Alle verwendeten Claims stehen in `10_brand_claims` der Brand Knowledge.
    Ein Claim ausserhalb dieser Liste ist ein Mangel.
15. Die Ansprache ist durchgehend "du", nie "Sie".
16. Es kommen keine fertigen Ads, Scripts oder finalen Copy-Texte vor — nur
    Briefs, die beschreiben WAS kommuniziert wird und WARUM.

## Abgrenzung

17. Der Guide enthaelt keine Analyse von Ads der eigenen Marke
    (sinsnlashes.com, @sinsnlashes, "Sins n Lashes").
18. Der Guide wurde nach dem Schreiben der Datei nicht erneut vollstaendig
    in die Antwort ausgegeben.
