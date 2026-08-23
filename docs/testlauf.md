# Testlauf — Anleitung

Stand 23. August 2026. Alles darin ist gebaut, aber **nichts davon ist gelaufen**
ausser dem PDF-Satz. Diese Anleitung sagt, welcher Lauf was beweist und woran
man sieht, dass es nicht geklappt hat.

## Wo getestet wird

Seit dem 23.08. gibt es die Agenten zweimal:

| Workspace | Rolle | Agenten |
|---|---|---|
| **KANA AI** | Produktkatalog, mandantenneutrale Master | kennen keine Marke |
| **Sins 'n Lashes** | Kundenkopien — **hier wird getestet** | lesen SNL aus `marke.json` |

Getestet wird im **SNL-Workspace**. Dort stehen die Kopien, dort liegen die
Speicher mit den SNL-Daten, und dort entspricht der Aufbau dem, was ein echter
Kunde bekommt.

## Vorher: drei Dinge setzen

**1. Umgebungsvariablen in Vercel** (Project Settings → Environment Variables):

```
ANTHROPIC_API_KEY_SNL        = <Schluessel des SNL-Workspace>
ANTHROPIC_WISSENS_STORE_ID   = memstore_01Raq6r9zdmqVGBL5VDe6KCT
ANTHROPIC_ERGEBNIS_STORE_ID  = memstore_01JCK9JAqCpf9ZfS269mGCiR
ANTHROPIC_MAX_LIST_COST_CENT = 800
```

Die Speicher-IDs sind die des **SNL-Workspace**. Die des KANA-Workspace
(`memstore_01176GMh…` / `memstore_01K2LdhA…`) gehoeren zum Produktkatalog und
sind hier falsch.

Ohne die Wissens-ID laeuft die Projektion ins Leere und jeder Agent meldet
"Keine Brand Knowledge gefunden". Ohne die Ergebnis-ID bekommt kein Agent
Schreibrecht, und Analysen wie Guides gehen nach der Sitzung verloren.

**Wichtig zur Nutzerzuordnung:** `anthropicFuerNutzer()` findet den Workspace
ueber `organizations.user_id`. Die Organisation "Sins n Lashes"
(`b636c4f2-…`) hat aktuell **keinen** Nutzer zugeordnet — der Testnutzer
`user_3F2YYla4UaJ5vK7tJaxnOLe3MKV` haengt an einer eigenen Organisation ohne
Workspace und landet damit im KANA-Workspace. Fuer einen Test im SNL-Workspace
entweder `organizations.user_id` der SNL-Zeile auf den Testnutzer setzen, oder
direkt ueber die API testen (unten).

**2. Vault im SNL-Workspace fuellen** — `vlt_011CeKegL3r5nCfWRtskkwMm` ist
angelegt, aber **leer**. Zwei Credentials eintragen, beide als Environment
variable, beide Header-Injection:

| Secret name | Allowed hosts |
|---|---|
| `APIFY` | `api.apify.com` |
| `GEMINI_API_KEY` | `generativelanguage.googleapis.com` |

Es sind dieselben Werte wie im KANA-Workspace — Vaults sind
workspace-gebunden und lassen sich nicht kopieren.

Die vier bereits vorhandenen Vaults im SNL-Workspace stammen aus aelteren
Versuchen und fuehren `static_bearer`-Credentials. Das ist der MCP-Typ; fuer
`$APIFY` in einem bash-Aufruf taugt er nicht.

**3. Nichts ist committed.** Alle Aenderungen liegen uncommitted auf
`feat/onboarding`.

## Zuerst: Bereitschaft pruefen

Nach dem Deploy im Browser aufrufen:

```
https://kana-ai.vercel.app/api/bereitschaft
```

Der Endpunkt prueft in einem Aufruf, ob ein Lauf ueberhaupt gelingen kann:
welche Umgebungsvariablen gesetzt sind (nur ja/nein, nie Werte), ob die
Speicher erreichbar sind und die erwarteten Dateien enthalten, ob ein Roster
hinter seinen Unteragenten herhinkt, ob noch eine Marke in einem Master-Prompt
steht, und ob es ueberhaupt offene Breakdowns gibt.

| `status` | Bedeutung |
|---|---|
| `bereit` | Alles steht. Lauf starten. |
| `eingeschraenkt` | Laeuft, aber etwas fehlt — die Warnungen lesen. |
| `blockiert` | Ein Lauf wuerde scheitern und trotzdem kosten. |

Das ist der schnellste Weg, die Umgebungsvariablen zu pruefen: von aussen sind
sie nicht einsehbar, die laufende Anwendung kennt sie.

## Ausgangslage

Was in der Datenbank steht (Stand 23.08.):

| Tabelle | Zeilen | Inhalt |
|---|---|---|
| `brand_knowledge` | 5 | `brand_campaigns`, `brand_products`, `brand_social`, `brand_visual`, `brand_website` |
| `ad_research` | 8 | echte Wettbewerber, alle `bereit_fuer_analyst` |
| `analyst_results` | 2 | Calisi Beauty, Lashella — **6 Ads sind offen** |

Sieben der zwoelf Markenwissen-Schluessel fehlen, darunter `brand_identity`,
`brand_audience` und `brand_claims`. Das ist echt und kein Fehler — es ist die
Aufgabe des Brand Expert. Der Strategist wird die Luecke melden.

## Lauf 1 — Strategist mit Analyst (der wichtigste)

Der Lauf, der die meisten neuen Teile auf einmal prueft: Projektion,
Delegation an den Analysten, Rueckuebernahme, PDF-Satz im neuen Design,
Auslieferung an den Kunden.

Auftrag als erste Nachricht, mit kleiner Zahl anfangen:

```
AUFTRAG
Anzahl: 4 Creative Briefs
Kopfzeile fuer die Kastengrafik: 5 Stages · 4 Creative Briefs
Verteilung: Stage 1 zwei Image-Briefs, Stage 2 zwei Video-Briefs.
```

**Was passieren muss, der Reihe nach:**

1. Im Log `[speicherProjektion] hinein: wissensbasis.json (5 Eintraege), breakdowns.json (6 von 8 offen, status offen), auftrag.json, bekannte-ads.json`
2. Der Strategist nennt den gefundenen Speicherpfad
3. Schritt 3: er beauftragt den Creative Analyst — im Chat als
   "Creative Analyst uebernimmt" sichtbar
4. Der Analyst schreibt 6 Dateien nach `kana-ergebnisse/analysen/`
5. Der Strategist schreibt den Guide nach `kana-ergebnisse/guides/`
6. Der Dokumentenbauer setzt das PDF nach `/mnt/session/outputs/`
7. `[speicherProjektion] Lieferungen: strategy-guide.pdf`
8. `[speicherProjektion] heraus: 6/6 Analysen`
9. Im Chat erscheint ein Downloadlink

**Woran man sieht, dass etwas nicht stimmt:**

| Symptom | Ursache |
|---|---|
| "Keine Brand Knowledge gefunden" | `ANTHROPIC_WISSENS_STORE_ID` fehlt oder falsch |
| Analyst wird nie beauftragt | `breakdowns.json` fehlt — Projektion pruefen |
| Analyst meldet "score.js fehlt" | Pfad `/mnt/memory/kana-wissen/werkzeuge/score.js` pruefen |
| Analysen tauchen nicht in `analyst_results` auf | Ergebnisspeicher fehlt oder nicht `read_write` |
| PDF entsteht, aber kein Link im Chat | Beta-Header bei `files.list` oder Bucket-MIME |
| PDF-Schriftzeile sagt "DejaVu Sans" | Skill-Bundle unvollstaendig hochgeladen |

Das PDF muss **hell** sein, Deckblatt in `#F6F4EF` mit dem Orbital-Motiv,
Akzentfarbe Petrol `#1F4B45`. Steht dort Indigo oder ein dunkles Deckblatt,
zieht der Dokumentenbauer eine alte Skill-Version.

## Lauf 2 — Brand Expert

Prueft den Vault und die Rueckuebernahme des Markenwissens.

```
Erhebe brand_identity und brand_audience fuer Sins n Lashes.
Nutze die Website und die Social-Profile.
```

Erwartet: Dateien unter `kana-ergebnisse/wissen/`, danach im Log
`[speicherProjektion] heraus: 2/2 Wissenseintraege` und zwei neue Zeilen in
`brand_knowledge`.

Schlaegt Apify mit 401 fehl, stimmt der Wert des Secrets `APIFY` nicht.

## Lauf 3 — Creative Researcher (zuletzt)

Der teuerste und langsamste. Erst starten, wenn 1 und 2 sauber liefen.

```
Suche 2 Video-Ads zum Thema Wimpernserum, Land DE.
```

Erwartet: `apify-suche.sh` meldet Rohtreffer, `filter.js` meldet die Auswahl,
je Ad eine Datei unter `/mnt/session/outputs/ads/`.

**Der wahrscheinlichste Stolperstein:** der Video-Download. Facebook liefert
ueber wechselnde Subdomains (`video-fra3-1.xx.fbcdn.net`). Ob `fbcdn.net` in
`allowed_hosts` diese mitabdeckt, ist ungeprueft. Schlaegt der Download fehl,
speichert der Agent die Ad ohne Breakdown weiter — der Lauf bricht nicht ab, aber
`datenstatus` bleibt bei allen Ads auf "nur Library-Daten". Dann muessen die
konkreten Hosts einzeln in die Liste.

## Kosten

Der Deckel liegt bei 800 Cent je Lauf. Gemessene Vergleichswerte (Strategist
auf sonnet-4-6, 20 Briefs): 40 bis 117 Cent. Mit Opus 5 und effort high sowie
dem Analysten in derselben Sitzung ist mit dem Zwei- bis Dreifachen zu rechnen.
Der erste Lauf sollte mit 4 Briefs starten, nicht mit 20.

Der tatsaechliche Wert steht nach jedem Lauf in `session.usage.list_cost`
(in Cent). Bitte einmal ablesen und den Deckel danach nachziehen.

## Was bewusst nicht aktiv ist

**Outcomes.** Die Rubriken liegen unter `agents/rubriken/`, sind aber nicht
eingeschaltet — sie vervielfachen die Kosten je Lauf. Siehe
`agents/rubriken/LIESMICH.md`.


## Anhang — Test ohne Web-App

Wenn die Nutzerzuordnung nicht angefasst werden soll, laesst sich eine Sitzung
direkt starten. Der Client uebernimmt dann allerdings weder Projektion noch
Rueckuebernahme — geprueft wird nur das Verhalten der Agenten selbst.

```bash
export SNL=<Schluessel des SNL-Workspace>
curl -s -X POST https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $SNL" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" -H "content-type: application/json" \
  -d '{
    "agent": {"type":"agent","id":"agent_017VAtV3U3Sg7Ste8kM8NpLA"},
    "environment_id": "env_01CXFqDDFFbdB8crcU1PJzFF",
    "vault_ids": ["vlt_011CeKegL3r5nCfWRtskkwMm"],
    "resources": [
      {"type":"memory_store","memory_store_id":"memstore_01Raq6r9zdmqVGBL5VDe6KCT","access":"read_only"},
      {"type":"memory_store","memory_store_id":"memstore_01JCK9JAqCpf9ZfS269mGCiR","access":"read_write"}
    ],
    "title": "Testlauf",
    "budget": {"type":"limit","max_list_cost":{"amount":"400","currency":"USD"}}
  }'
```

Danach den Auftrag als `user.message` an `/v1/sessions/<id>/events` senden und
den Verlauf in der Console unter **Managed Agents → Sessions** mitlesen.

Achtung: In diesem Weg fehlen `wissensbasis.json` und `breakdowns.json` im
Speicher — die legt sonst die Projektion an. Der Strategist wird das melden und
stoppen. Fuer einen vollstaendigen Durchlauf ist der Weg ueber die Web-App noetig.

## IDs im SNL-Workspace

| Was | ID |
|---|---|
| Creative Strategist (Koordinator) | `agent_017VAtV3U3Sg7Ste8kM8NpLA` |
| Creative Analyst | `agent_014j9PojGvzdsCpHsNs14rU5` |
| Creative Researcher | `agent_01JN2THNez6Wi7dASKLYbkbZ` |
| Brand Expert | `agent_01TVdFvppdR5yF6bqTVhd6Gj` |
| Sub_Dokumentenbauer | `agent_0146ub9EqDhtZBiyqrm1XRra` |
| Sub_Datenpfleger | `agent_01T2mmRaSJjyJnT51mDEWDsD` |
| Environment | `env_01CXFqDDFFbdB8crcU1PJzFF` |
| Vault (leer) | `vlt_011CeKegL3r5nCfWRtskkwMm` |
| Speicher kana-wissen | `memstore_01Raq6r9zdmqVGBL5VDe6KCT` |
| Speicher kana-ergebnisse | `memstore_01JCK9JAqCpf9ZfS269mGCiR` |
| Skill kana-corporate-design | `skill_01P638igVcSgQrSZkFwQH33J` |
