WEEKLY UPDATE — Scrapt alle Kanäle neu, vergleicht mit dem gespeicherten Stand und markiert Änderungen.

WICHTIGE REGEL FÜR MARKIERUNGEN:
- Alles was NEU ist (nicht in der Wissensbasis vorhanden) → mit [NEU] am Anfang der Zeile markieren
- Alles was sich GEÄNDERT hat (andere Zahl, anderer Text) → mit [GEÄNDERT] markieren
- Was unverändert ist → normal ausgeben, kein Tag
- Beispiel: "[GEÄNDERT] TikTok Follower: 312.000 (war: 302.300)"
- Beispiel: "[GEÄNDERT] Preis Hauptprodukt: 39,99 EUR (war: 36,99 EUR)"

═══ PHASE 0: QUELLEN BESTIMMEN ═══

Die Quellen stehen in /mnt/memory/kana-wissen/marke.json, die Wettbewerber
zusätzlich im Eintrag `brand_competitors` der Wissensbasis — dort stehen auch
die, die seit dem Setup dazugekommen sind.

    jq -r '.website, .domain, .name' /mnt/memory/kana-wissen/marke.json
    jq -r '.kanaele | to_entries[] | "\(.key): \(.value)"' /mnt/memory/kana-wissen/marke.json
    jq -r '.quellen | to_entries[] | "\(.key): \(.value)"' /mnt/memory/kana-wissen/marke.json
    jq -r '.wettbewerber[] | "\(.name) \(.website // "")"' /mnt/memory/kana-wissen/marke.json

Fehlt marke.json, melde "Keine Markendaten gefunden." und stoppe.

═══ PHASE 1: BASELINE LADEN ═══

Der gespeicherte Stand liegt im Wissensspeicher und ist deine Vergleichsgrundlage:

    jq -r '.[] | select(.key=="brand_social") | .content' /mnt/memory/kana-wissen/wissensbasis.json
    jq -r '.[] | select(.key=="brand_competitors") | .content' /mnt/memory/kana-wissen/wissensbasis.json

Lies gezielt mit jq, statt alles in den Kontext zu ziehen. Merke dir die
wichtigsten Zahlen: Follower je Kanal, Preise, Lagerstand, aktive Ads.

Fehlt die Datei oder ist sie leer, gibt es keine Baseline — dann ist alles [NEU],
und du sagst das im Report deutlich. Ein Weekly Update ohne Baseline ist
faktisch ein Setup; weise darauf hin, dass BRAND SETUP der passendere Modus wäre.

═══ PHASE 2: NEU SCRAPEN ═══

Dieselben Quellen wie beim Setup, `<…>` steht für einen Wert aus marke.json:

 1. web_fetch <website> — Lagerstand (Button-Text!), Preise, Offers
 2. Apify RAG Browser https://www.tiktok.com/<kanaele.tiktok> — Neue Follower-Zahl
 3. Apify RAG Browser https://www.instagram.com/<kanaele.instagram ohne @>/ — Neue Follower-Zahl
 4. Apify Ad Library "<name>" — Neue und gestoppte Ads, Laufzeiten
 5. Apify RAG Browser <quellen.bewertungen> — Neue Bewertungen
 6. Je Wettbewerber: Apify Ad Library "<wettbewerber.name>" — Konkurrenz-Änderungen
 7. Apify RAG Browser <quellen.community> mit dem Markennamen — Neue Community-Stimmen

Kanäle, die in marke.json leer sind, überspringst du wortlos.

Erkenntnisse mit [NEU]/[GEÄNDERT] in die betroffenen Einträge einarbeiten und je
Eintrag eine Datei nach /mnt/memory/kana-ergebnisse/wissen/<key>.json schreiben.
`content` enthält den vollständigen neuen Text, nicht nur die Änderung — der
Eintrag ersetzt den alten, er ergänzt ihn nicht.
Jede Datei anschliessend mit `jq . <datei>` prüfen.

═══ PHASE 3: UPDATE-REPORT (EXAKT dieses Format) ═══

`<MARKENNAME>` ist `.name` aus marke.json, in Versalien; Kastenbreite unverändert.

╔══════════════════════════════════════════════════════╗
║     <MARKENNAME> — WEEKLY UPDATE REPORT             ║
║     KW [aktuelle KW] — [Datum TT.MM.YYYY]           ║
╚══════════════════════════════════════════════════════╝

─── WEBSITE UPDATE ───────────────────────────────────
Neue Produkte: [Ja: Details mit [NEU] / Nein]
Preisänderungen: [Ja: Details mit [GEÄNDERT] / Nein]
Aktive Offers: [Details]
Lagerstand: [Welche Produkte verfügbar / OOS — Änderungen markiert]

─── SOCIAL MEDIA ─────────────────────────────────────
[Je Kanal aus marke.json ein Block:]
  Plattform (Handle):
    Follower: [Zahl] (Quelle: Scrape [Datum])
    Wachstum: [+/- X seit letztem Update]
    Top Post: [Hook] — [Kennzahl]
    Engagement Trend: ↑ steigend / ↓ fallend / → stabil

─── META ADS (Top 3 nach Laufzeit) ───────────────────
#1: "[Hook/Headline]" — [X Tage aktiv] — [Format]
    Warum stark: [1 Satz]
#2: "[Hook/Headline]" — [X Tage aktiv] — [Format]
#3: "[Hook/Headline]" — [X Tage aktiv] — [Format]
Ad-Muster diese Woche: [Was haben Top-Ads gemeinsam?]

─── KONKURRENZ ────────────────────────────────────────
[Je Wettbewerber eine Zeile: Name: Neue Ads / Aktivität]
Neue Threats: [Details oder "Keine"]
Neue Chancen: [Details oder "Keine"]

─── ZIELGRUPPE & KUNDENSTIMMEN ───────────────────────
Bewertungen: [X.X Sterne / X Reviews, Quelle]
Neue positive Stimmen: [Zitat]
Kaufblocker / Einwände: [Zitat]
Community-Stimmung: [positiv/neutral/negativ + Grund]

─── TOP 3 HANDLUNGSEMPFEHLUNGEN ──────────────────────
1. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
2. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]
3. [Konkrete Aktion] — Priorität: [Hoch/Mittel/Niedrig]

─── FRÜHWARNSIGNALE ───────────────────────────────────
[Potenzielle Risiken oder "Keine"]

─── GESCHRIEBENE EINTRÄGE ────────────────────────────
[Je Datei eine Zeile: <key>.json — <was sich geändert hat>]

─── NÄCHSTE WOCHE ─────────────────────────────────────
Zu beobachten: [Details]
Empfohlener Content-Fokus: [Details]
Nächster Update empfohlen: [Datum + 7 Tage]
