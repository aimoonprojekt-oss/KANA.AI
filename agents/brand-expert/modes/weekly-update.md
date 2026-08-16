WEEKLY UPDATE — Scrapt alle Kanäle neu, vergleicht mit dem gespeicherten Stand und markiert Änderungen.

WICHTIGE REGEL FÜR MARKIERUNGEN:
- Alles was NEU ist (nicht in DB vorhanden) → mit [NEU] am Anfang der Zeile markieren
- Alles was sich GEÄNDERT hat (andere Zahl, anderer Text) → mit [GEÄNDERT] markieren
- Was unverändert ist → normal ausgeben, kein Tag
- Beispiel: "[NEU] TikTok Follower: 312.000 (war: 302.300)"
- Beispiel: "[GEÄNDERT] Preis Wimpernserum: €39,99 (war: €36,99)"

═══ PHASE 1: AKTUELLEN STAND LADEN ═══

Schritt 1 — Alle gespeicherten brand_knowledge-Einträge laden (das ist die Vergleichs-Baseline).
Schreibe sie nach /workspace/baseline.json und lies gezielt mit jq.
Merke dir die wichtigsten Zahlen: Follower TikTok/IG, Preise, Lagerstand, aktive Ads

═══ PHASE 2: NEU SCRAPEN ═══

Schritt 2 — web_fetch https://www.sinsnlashes.com/ — Lagerstand (Button-Text!), Preise, Offers
Schritt 3 — Apify RAG Browser https://www.tiktok.com/@sinscosmetics — Neue Follower-Zahl
Schritt 4 — Apify RAG Browser https://www.instagram.com/sinsnlashes/ — Neue Follower-Zahl
Schritt 5 — Apify Ad Library "sinsnlashes" — Neue/gestoppte Ads, Laufzeiten
Schritt 6 — Apify RAG Browser https://www.trustpilot.com/review/sinsnlashes.com — Neue Bewertungen
Schritt 7 — Apify Ad Library "Orphica" — Konkurrenz-Änderungen
Schritt 8 — Apify Ad Library "nanolash" — Konkurrenz-Änderungen
Schritt 9 — Apify RAG Browser gutefrage.net "sins n lashes" — Neue Community-Stimmen

Erkenntnisse mit [NEU]/[GEÄNDERT] Tags speichern: Upsert für alle betroffenen keys

═══ PHASE 3: UPDATE-REPORT (EXAKT dieses Format) ═══

╔══════════════════════════════════════════════════════╗
║     SINS 'N LASHES — WEEKLY UPDATE REPORT           ║
║     KW [aktuelle KW] — [Datum TT.MM.YYYY]           ║
╚══════════════════════════════════════════════════════╝

─── WEBSITE UPDATE ───────────────────────────────────
Neue Produkte: [Ja: Details mit [NEU] / Nein]
Preisänderungen: [Ja: Details mit [GEÄNDERT] / Nein]
Aktive Offers: [Details]
Lagerstand: [Welche Produkte verfügbar / OOS — Änderungen markiert]

─── SOCIAL MEDIA ─────────────────────────────────────
TikTok (@sinscosmetics):
  Follower: [Zahl] (Quelle: Scrape [Datum])
  Wachstum: [+/- X seit letztem Update]
  Top Post der Woche: [Hook] — [Views] Views
  Engagement Trend: ↑ steigend / ↓ fallend / → stabil

Instagram (@sinsnlashes):
  Follower: [Zahl] (Quelle: Scrape [Datum])
  Wachstum: [+/- X seit letztem Update]
  Top Post: [Details]

─── META ADS (Top 3 nach Laufzeit) ───────────────────
#1: "[Hook/Headline]" — [X Tage aktiv] — [Format]
    Warum stark: [1 Satz]
#2: "[Hook/Headline]" — [X Tage aktiv] — [Format]
#3: "[Hook/Headline]" — [X Tage aktiv] — [Format]
Ad-Muster diese Woche: [Was haben Top-Ads gemeinsam?]

─── KONKURRENZ ────────────────────────────────────────
Orphica: [Neue Ads / Aktivität]
Nanolash: [Neue Ads / Aktivität]
Neue Threats: [Details oder "Keine"]
Neue Chancen: [Details oder "Keine"]

─── ZIELGRUPPE & KUNDENSTIMMEN ───────────────────────
Trustpilot: [X.X Sterne / X Reviews]
Neue positive Stimmen: [Zitat]
Kaufblocker / Einwände: [Zitat]
Community-Stimmung: [positiv/neutral/negativ + Grund]

─── TOP 3 HANDLUNGSEMPFEHLUNGEN ──────────────────────
1. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
2. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
3. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]

─── FRÜHWARNSIGNALE ───────────────────────────────────
[Potenzielle Risiken oder "Keine"]

─── NÄCHSTE WOCHE ─────────────────────────────────────
Zu beobachten: [Details]
Empfohlener Content-Fokus: [Details]
Nächster Update empfohlen: [Datum + 7 Tage]
