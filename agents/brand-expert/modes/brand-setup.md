BRAND SETUP — Einmaliger vollständiger Aufbau der Wissensbasis von Grund auf.
Ziel: Nach diesem Lauf ist die Wissensbasis zu 100% befüllt. Kein Datenpunkt darf fehlen.

═══ PHASE 0: QUELLEN BESTIMMEN ═══

Die Quellen stehen NICHT in diesem Text, sondern in

  /mnt/memory/kana-wissen/marke.json

Lies sie zuerst und leite daraus deine Schrittliste ab:

    jq -r '.website, .domain' /mnt/memory/kana-wissen/marke.json
    jq -r '.kanaele | to_entries[] | "\(.key): \(.value)"' /mnt/memory/kana-wissen/marke.json
    jq -r '.quellen | to_entries[] | "\(.key): \(.value)"' /mnt/memory/kana-wissen/marke.json
    jq -r '.wettbewerber[] | "\(.name) \(.website // "")"' /mnt/memory/kana-wissen/marke.json
    jq -r '.hero_produkt.name' /mnt/memory/kana-wissen/marke.json

Nenne die Liste der Quellen, die du daraus gebildet hast, einmal ausdrücklich —
bevor du den ersten Aufruf machst. Fehlt marke.json, melde "Keine Markendaten
gefunden." und stoppe.

Die Wettbewerber aus marke.json sind der Startpunkt. Stösst du beim Scrapen auf
weitere, nimm sie auf und vermerke sie in `brand_competitors` — dort pflegt sich
die Liste danach selbst fort.

═══ PHASE 1: VOLLSTÄNDIGER SCRAPE ═══

Arbeite diese Quellen der Reihe nach ab. `<…>` steht jeweils für einen Wert aus
marke.json.

 1. web_fetch <website> — Alle Produkte, Preise, Lagerstand (Button-Text!), Offers, Hero Copy, Reviews
 2. web_fetch je eine Produktseite, mindestens die des Hauptprodukts — Inhaltsstoffe, Claims, Preise
 3. Apify RAG Browser https://www.tiktok.com/<kanaele.tiktok> — Follower, Top-Videos, Beschreibung
 4. Apify RAG Browser https://www.instagram.com/<kanaele.instagram ohne @>/ — Follower, Bio, neueste Posts
 5. Apify Ad Library "<name>" — Alle aktiven Ads, Laufzeiten, Creatives
 6. Apify RAG Browser <quellen.bewertungen> — Bewertungen, Kaufblocker, Lobpunkte
 7. Apify RAG Browser <quellen.community> mit dem Markennamen als Suchbegriff — Community-Stimmen, Einwände
 8. Je Wettbewerber: Apify Ad Library "<wettbewerber.name>" — Konkurrenz vollständig erfassen
 9. Je Wettbewerber mit Website: Apify RAG Browser <wettbewerber.website> — Produkte, Preise, Claims

Kanäle, die in marke.json leer sind, überspringst du wortlos — das ist kein
Fehler, sondern heisst, dass die Marke dort nicht vertreten ist.

Schreibe jedes Scrape-Ergebnis in eine eigene Datei unter /workspace/scrape/,
bevor du es auswertest. /workspace ist Arbeitsfläche, nicht Ergebnis.

═══ PHASE 2: WISSENSBASIS AUFBAUEN ═══

Schreibe je Eintrag eine Datei nach

  /mnt/memory/kana-ergebnisse/wissen/<key>.json

Lege das Verzeichnis zuerst an: mkdir -p /mnt/memory/kana-ergebnisse/wissen

Aus diesem Lauf entstehen mindestens:

- "overview"           — Marke auf einen Blick, alle Kennzahlen
- "brand_products"     — Alle Produkte, Preise, Lagerstand, Inhaltsstoffe
- "brand_social"       — Alle Plattformen, Follower, Top-Content
- "brand_website"      — Komplette Website-Analyse
- "brand_audience"     — Zielgruppe, Bewertungen, Community-Stimmen
- "brand_competitors"  — Vollständige Konkurrenz-Analyse

Format und Regeln stehen im Abschnitt ERGEBNISSE SCHREIBEN deines Prompts.
Jede Datei anschliessend mit `jq . <datei>` prüfen.

═══ PHASE 3: VOLLSTÄNDIGER SETUP-REPORT ═══

Gib den Report EXAKT in diesem Format aus. `<MARKENNAME>` ist `.name` aus
marke.json, in Versalien; die Kastenbreite bleibt unverändert.

╔══════════════════════════════════════════════════════╗
║   <MARKENNAME> — BRAND SETUP REPORT                 ║
║   Erstellt: [Datum TT.MM.YYYY] — Vollständige Basis  ║
╚══════════════════════════════════════════════════════╝

─── MARKE IM ÜBERBLICK ───────────────────────────────
Website: [Domain]
Hero Product: [Produkt + Preis]
Plattformen: [Liste mit Follower-Zahlen]
Gesamtbewertung: [X.X Sterne / X Reviews, Quelle]

─── ALLE PRODUKTE & PREISE ───────────────────────────
[Jedes Produkt: Name | Preis | Lagerstand | Hauptclaim]

─── SOCIAL MEDIA BASELINE ────────────────────────────
[Je Kanal aus marke.json eine Zeile: Plattform (Handle): Follower | Kennzahl]

─── TOP META ADS (Stand heute) ───────────────────────
#1: "[Hook]" — [X Tage aktiv] — [Format]
#2: "[Hook]" — [X Tage aktiv] — [Format]
#3: "[Hook]" — [X Tage aktiv] — [Format]

─── KONKURRENZ BASELINE ──────────────────────────────
[Je Wettbewerber eine Zeile: Name: Follower / Preise / aktive Ads]
Positionierung der Marke vs. Konkurrenz: [Zusammenfassung]

─── ZIELGRUPPE & KAUFBLOCKER ─────────────────────────
Kernzielgruppe: [Details]
Häufigste Kaufblocker: [Liste aus Bewertungen und Community]
Häufigste Lobpunkte: [Liste]

─── SWOT ANALYSE ─────────────────────────────────────
Stärken: [Liste]
Schwächen: [Liste]
Chancen: [Liste]
Risiken: [Liste]

─── TOP 5 SOFORT-MASSNAHMEN ──────────────────────────
1. [Aktion] — Priorität: Hoch
2. [Aktion] — Priorität: Hoch
3. [Aktion] — Priorität: Mittel
4. [Aktion] — Priorität: Mittel
5. [Aktion] — Priorität: Niedrig

─── GESCHRIEBENE EINTRÄGE ────────────────────────────
[Je Datei eine Zeile: <key>.json — <kurz, was drinsteht>]

─── NÄCHSTE SCHRITTE ─────────────────────────────────
Erster Weekly Update empfohlen: [Datum + 7 Tage]
Fokus-Bereiche: [Details]
