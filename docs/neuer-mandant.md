# Einen neuen Mandanten aufsetzen

Stand 23. August 2026. Richtwert: **zwei bis drei Stunden**, davon rund 30
Minuten Handarbeit und der Rest Warten auf Recherche-Läufe.

## Das Prinzip

Die Master-Agenten im Workspace **KANA AI** kennen keine Marke. Sie lesen alles,
was mandantenspezifisch ist, aus einer einzigen Datei:

```
/mnt/memory/kana-wissen/marke.json
```

Name, Kürzel, Domain, Kanäle, Hauptprodukt, Tonalität und die Suchbegriffe je
Produktkategorie. Ein neuer Kunde ist deshalb im Kern **eine ausgefüllte
JSON-Datei** — nicht ein neuer Satz Prompts.

Was trotzdem je Kunde neu entsteht: ein eigener Console-Workspace mit eigenen
Agentenkopien, eigenem Vault und eigenen Speichern. Agenten sind
workspace-gebunden; ein Master aus KANA AI lässt sich in einer Kundensitzung
nicht starten.

## Schritt 1 — Workspace anlegen (10 Min)

```bash
ANTHROPIC_ADMIN_KEY=sk-ant-admin... scripts/workspace-anlegen.sh "kunde-<kuerzel>"
```

Danach **von Hand in der Console**, weil die API es nicht kann:

- API-Schlüssel erzeugen → in den Passwortmanager
- Ausgabengrenze setzen (Notbremse, nicht das Kontingent)

Die Organisation erlaubt maximal 100 Workspaces. Das Skript warnt ab 80.

## Schritt 2 — marke.json ausfüllen (20 Min)

```bash
cp agents/mandanten/VORLAGE.marke.json agents/mandanten/<kuerzel>.marke.json
```

Die Felder sind selbsterklärend, zwei verdienen Aufmerksamkeit:

**`ausschluss`** — jede Schreibvariante des Markennamens, die Domain und alle
eigenen Social-Handles. Danach entscheiden Researcher und Analyst, was die
eigene Marke ist und übersprungen wird. Ein vergessener Handle bedeutet, dass
der Kunde seine eigenen Anzeigen als Wettbewerb analysiert bekommt.

**`such_keywords`** — je Produktkategorie vier bis sechs Begriffe, gemischt
deutsch und englisch. Der Researcher arbeitet sie der Reihe nach ab, wenn eine
Suchrunde zu wenig liefert. Zu wenige Begriffe heisst: er erreicht die
geforderte Anzahl nicht und sucht endlos.

Als ausgefülltes Beispiel dient `agents/mandanten/sins-n-lashes.marke.json`.

## Schritt 3 — Agenten kopieren (5 Min)

```bash
ANTHROPIC_API_KEY_KUNDE=sk-ant-... \
  node scripts/mandant-einrichten.mjs agents/mandanten/<kuerzel>.marke.json --schreiben
```

Das Skript kopiert alle Master, setzt die Roster-Verweise auf die neuen IDs um,
legt `kana-wissen` und `kana-ergebnisse` an, spielt `marke.json` ein und
übernimmt Werkzeuge und Referenzen aus dem Quellspeicher.

Ohne `--schreiben` läuft es als Probelauf. Es warnt, wenn ein Master noch einen
Mandantennamen im Prompt trägt — dann wäre die Spezialisierung mitkopiert
worden.

## Schritt 4 — Environment und Vault (15 Min, Handarbeit)

Beides ist workspace-gebunden und lässt sich nicht kopieren. Das Skript gibt am
Ende die konkreten Werte aus:

**Environment** — `type: cloud`, `networking: limited`, `allow_package_managers: false`.
`allowed_hosts`: `api.apify.com`, `generativelanguage.googleapis.com`,
`fbcdn.net`, dazu die Domain des Kunden mit und ohne `www.`

**Vault** — zwei Credentials, beide als Environment variable, beide **Header**:

| Secret name | Allowed hosts |
|---|---|
| `APIFY` | `api.apify.com` |
| `GEMINI_API_KEY` | `generativelanguage.googleapis.com` |

Apify und Gemini können dieselben Schlüssel wie bei anderen Kunden sein — sie
gehören euch, nicht dem Kunden. Nur wenn ein Kunde eigene Konten mitbringt,
werden es eigene.

## Schritt 5 — Datenbank und Vercel (10 Min)

Je Agent eine Zeile in `agents` mit `master_agent_id` auf den Master,
`environment_id`, `memory_store_ids` und `vault_ids` des Kunden.
`published: false`, `organization_id` auf die Organisation des Kunden.

In Vercel: `ANTHROPIC_API_KEY_<KUERZEL>` hinterlegen und in
`lib/anthropic/workspaces.ts` eine Zeile ergänzen — bewusst Code und nicht
Konfiguration, damit ein neuer Workspace im Pull Request sichtbar ist.

## Schritt 6 — Wissensbasis füllen (1–2 h, überwiegend Wartezeit)

Der Brand Expert erhebt die zwölf Schlüssel selbst. Nacheinander beauftragen:

```
Erhebe brand_identity und brand_audience für die Marke.
Nutze die Website und die Social-Profile.
```

Danach `brand_products`, `brand_social`, `brand_website`, `brand_competitors`,
`brand_claims`, `brand_content_bank`, `brand_strategy`, `brand_visual`,
`brand_campaigns`, `overview`.

Erst wenn `brand_claims` und `brand_identity` stehen, liefern Analyst und
Strategist brauchbare Ergebnisse — sie prüfen jede Empfehlung gegen die
erlaubten Claims.

## Schritt 7 — Erster echter Lauf

Nach `docs/testlauf.md`, aber mit kleiner Zahl: vier Briefs, zwei Ads. Erst
wenn das durchläuft, auf Produktionsgrössen gehen.

## Was man nicht vergessen darf

- **`roster-nachziehen.mjs` nach jeder Agentenänderung.** Ein Koordinator hält
  die Version seiner Unteragenten fest, wie sie beim Speichern war.
- **Der Kunde bekommt Kopien, keine Master.** Änderungen am Master erreichen
  bestehende Kunden nicht automatisch — das ist Absicht, aber man muss es
  wissen. Ein Rollout heisst: Master ändern, dann je Kunde nachziehen.
- **`marke.json` ist die einzige Stelle.** Wer eine Marke im Prompt findet, hat
  einen Fehler gefunden. `scripts/mandant-einrichten.mjs` prüft das bei jedem
  Lauf mit.
