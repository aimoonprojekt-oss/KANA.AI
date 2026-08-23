# Rubrik — Creative-Analyse je Ad

Gilt für den Creative Analyst. Bewertet wird der Satz Analysedateien unter
`/mnt/session/outputs/analysen/`, nicht die Chatantwort.

## Lieferung

1. Für jede Ad in `breakdowns.json`, die nicht der eigenen Marke gehoert,
   existiert genau eine Datei `/mnt/session/outputs/analysen/<ad_id>.json`.
2. Jede dieser Dateien ist gueltiges JSON (`jq .` laeuft ohne Fehler durch).
3. Jede Datei hat genau die fuenf Felder `ad_id`, `advertiser`, `score`,
   `klasse`, `content` — keine weiteren.
4. `ad_id` stimmt mit dem Dateinamen ueberein.
5. `score` ist eine Zahl zwischen 1.0 und 5.0.
6. `klasse` ist einer von: Ausnahme-Ad, Starke Ad, Durchschnittliche Ad,
   Schwache Ad, Keine Relevanz.
7. `klasse` passt zum `score` nach den Grenzen 4.5–5.0 / 3.5–4.4 / 2.5–3.4 /
   1.5–2.4 / 1.0–1.4.

## Inhalt je Analyse

8. `content` enthaelt eine K1–K6-Tabelle mit einer Begruendung je Kriterium.
9. `content` enthaelt den Hook-Text der Ad woertlich, nicht paraphrasiert.
10. `content` enthaelt einen Abschnitt zur Wettbewerbs-Einordnung, der
    mindestens einen konkreten USP von Sins 'n Lashes benennt.
11. `content` enthaelt mindestens eine Empfehlung, die einen konkreten
    Hook, eine Formel oder ein Format nennt — nicht "mehr UGC machen".
12. Alle Angaben stammen aus der Breakdown-Datei. Eigenschaften, die dort
    nicht stehen (Laufzeit, Reichweite, Budget), kommen nicht vor.

## Abgrenzung

13. Für Ads der eigenen Marke (sinsnlashes.com, @sinsnlashes,
    "Sins n Lashes") existiert KEINE Analysedatei.
14. Empfohlene Claims stehen in `10_brand_claims` der Brand Knowledge.
