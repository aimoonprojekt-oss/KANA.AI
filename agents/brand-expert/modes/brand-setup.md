BRAND SETUP — Einmaliger vollständiger Aufbau der Wissensbasis von Grund auf.
Ziel: Nach diesem Lauf ist die Datenbank zu 100% befüllt. Kein Datenpunkt darf fehlen.

═══ PHASE 1: VOLLSTÄNDIGER SCRAPE (alle Kanäle) ═══

Schritt 1 — web_fetch https://www.sinsnlashes.com/ — Alle Produkte, Preise, Lagerstand (Button-Text!), Offers, Hero Copy, Reviews
Schritt 2 — web_fetch je eine Produktseite (Wimpernserum, Bundle) — Inhaltsstoffe, Claims, Preise
Schritt 3 — Apify RAG Browser https://www.tiktok.com/@sinscosmetics — Follower, Top-Videos, Beschreibung
Schritt 4 — Apify RAG Browser https://www.instagram.com/sinsnlashes/ — Follower, Bio, neueste Posts
Schritt 5 — Apify Ad Library "sinsnlashes" — Alle aktiven Ads, Laufzeiten, Creatives
Schritt 6 — Apify RAG Browser https://www.trustpilot.com/review/sinsnlashes.com — Bewertungen, Kaufblocker, Lobpunkte
Schritt 7 — Apify RAG Browser gutefrage.net "sins n lashes" — Community-Stimmen, Einwände
Schritt 8 — Apify Ad Library "Orphica" — Konkurrenz vollständig erfassen
Schritt 9 — Apify Ad Library "nanolash" — Konkurrenz
Schritt 10 — Apify RAG Browser https://www.orphica.com — Produkte, Preise, Claims
Schritt 11 — Apify RAG Browser https://www.xlash.de — Konkurrenz-Website

Schreibe jedes Scrape-Ergebnis in eine eigene Datei unter /workspace/scrape/,
bevor du es auswertest.

═══ PHASE 2: WISSENSBASIS AUFBAUEN ═══

Speichere alle Erkenntnisse vollständig (Upsert auf brand_knowledge):
- "overview" — Marke auf einen Blick, alle Kennzahlen
- "brand_products" — Alle Produkte, Preise, Lagerstand, Inhaltsstoffe
- "brand_social" — Alle Plattformen, Follower, Top-Content
- "brand_website" — Komplette Website-Analyse
- "brand_audience" — Zielgruppe, Trustpilot, Community-Stimmen
- "brand_competitors" — Vollständige Konkurrenz-Analyse

═══ PHASE 3: VOLLSTÄNDIGER SETUP-REPORT ═══

Gib den Report EXAKT in diesem Format aus:

╔══════════════════════════════════════════════════════╗
║   SINS 'N LASHES — BRAND SETUP REPORT               ║
║   Erstellt: [Datum TT.MM.YYYY] — Vollständige Basis  ║
╚══════════════════════════════════════════════════════╝

─── MARKE IM ÜBERBLICK ───────────────────────────────
Website: sinsnlashes.com
Hero Product: [Produkt + Preis]
Plattformen: [Liste mit Follower-Zahlen]
Gesamtbewertung Trustpilot: [X.X Sterne / X Reviews]

─── ALLE PRODUKTE & PREISE ───────────────────────────
[Jedes Produkt: Name | Preis | Lagerstand | Hauptclaim]

─── SOCIAL MEDIA BASELINE ────────────────────────────
TikTok (@sinscosmetics): [Follower] | [Top Video: Views]
Instagram (@sinsnlashes): [Follower] | [Engagement-Rate]
YouTube (@sinscosmetics): [Subscriber]
Pinterest (sinscosmetics): [Follower / Monatl. Views]

─── TOP META ADS (Stand heute) ───────────────────────
#1: "[Hook]" — [X Tage aktiv] — [Format]
#2: "[Hook]" — [X Tage aktiv] — [Format]
#3: "[Hook]" — [X Tage aktiv] — [Format]

─── KONKURRENZ BASELINE ──────────────────────────────
Orphica: [Follower / Preise / aktive Ads]
Nanolash: [Follower / Preise / aktive Ads]
xlash: [Informationen]
Positionierung SNL vs. Konkurrenz: [Zusammenfassung]

─── ZIELGRUPPE & KAUFBLOCKER ─────────────────────────
Kernzielgruppe: [Details]
Häufigste Kaufblocker: [Liste aus Trustpilot/Community]
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

─── NÄCHSTE SCHRITTE ─────────────────────────────────
Erster Weekly Update empfohlen: [Datum + 7 Tage]
Fokus-Bereiche: [Details]
