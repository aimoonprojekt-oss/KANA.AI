# KI-Verordnung — was umgesetzt ist und was fehlt

Stand 19.08.2026. **Interne Notiz, gehört nicht auf die Website.** Was hier
als Lücke steht, ist im Streitfall ein Eingeständnis — deshalb steht es hier
und nicht auf `/ki-transparenz`.

Rechtsgrundlage: Verordnung (EU) 2024/1689 (KI-Verordnung). Die
Transparenzpflichten aus Art. 50 gelten seit dem **2. August 2026**.
Bußgeldrahmen bei Verstößen: bis 15 Mio. € oder 3 % des weltweiten
Jahresumsatzes, je nachdem was höher ist.

Dies ist keine Rechtsberatung. Die Einordnung unten ist eine Einschätzung
aus dem Verordnungstext und muss anwaltlich bestätigt werden.

---

## Umgesetzt

**Art. 50 Abs. 1 — Offenlegung der Interaktion mit einem KI-System.**
Der Hinweis steht dort, wo die Interaktion beginnt, nicht nur auf einer
Unterseite. Abs. 5 verlangt „spätestens zum Zeitpunkt der ersten
Interaktion", „klar und erkennbar" und barrierefrei.

| Ort | Umsetzung |
|---|---|
| Chat, leerer Start | Langfassung über den Startprompts |
| Chat, laufende Sitzung | Kurzfassung über dem Eingabefeld |
| Chat, Dateikasten | Kurzfassung über den erzeugten Dateien |
| Support-Blase | Kopfzeile „KI-Assistent · antwortet automatisch", plus Begrüßungstext |
| Portal, Agentenansicht | Langfassung über der Agentenliste |
| Landingpage | Eigener Block im Vertrauensabschnitt |
| Fußzeile überall | Link auf `/ki-transparenz` |

**Art. 50 Abs. 2 — maschinenlesbare Markierung, teilweise.**
Die vom Dokumentenbauer erzeugten PDFs tragen die Markierung in den
Metadaten (`creator`, `subject`), siehe
`agents/dokumentenbauer/werkzeuge/kana_pdf.py`.

---

## Offen — hier besteht Handlungsbedarf

**1. Art. 50 Abs. 2 ist nur teilweise erfüllt.**
Verlangt ist eine maschinenlesbare Markierung *aller* synthetisch erzeugten
Inhalte. Abgedeckt sind bisher nur PDFs. Nicht abgedeckt:

- Texte, die im Chat ausgegeben und vom Kunden kopiert werden
- Bilder und Videos, die der Creative-Agent erzeugt (dort wäre C2PA /
  Content Credentials der übliche Weg)
- Dateien anderer Agenten ohne eigenen Metadatenpfad

Ein sichtbarer Satz auf der Seite erfüllt Abs. 2 nicht.

**2. Art. 4 — KI-Kompetenz.**
Gilt bereits seit dem 2. Februar 2025. Anbieter und Betreiber müssen
sicherstellen, dass ihr Personal über ausreichende KI-Kompetenz verfügt.
Nachweisbar dokumentieren (Schulung, Datum, Teilnehmer).

**3. Rolle im Sinne der Verordnung ist nicht förmlich bestimmt.**
KANA AI bringt ein KI-System unter eigenem Namen in Verkehr und ist damit
nach Art. 3 Nr. 3 sehr wahrscheinlich **Anbieter**, nicht nur Betreiber.
Daran hängt, welche Pflichten greifen. Anwaltlich festhalten.

**4. Die Haftungsbegrenzung wirkt vertraglich noch nicht.**
Der Text auf `/ki-transparenz` ist die inhaltlich richtige, gestufte
Fassung — aber eine Haftungsbegrenzung wird nur wirksam, wenn sie beim
Vertragsschluss einbezogen wird. Ein Link in der Fußzeile genügt nicht.
Sie gehört in AGB, die beim Kauf im Stripe-Checkout bestätigt werden.

**5. Impressum und Datenschutzerklärung enthalten Platzhalter.**
Siehe `/recht`. Ein unvollständiges Impressum ist nach § 5 DDG abmahnbar.

**6. Pflichten der Kunden sind nicht abgefragt.**
Veröffentlicht ein Kunde KI-erzeugte Texte zu Themen von öffentlichem
Interesse, treffen ihn nach Art. 50 Abs. 4 eigene Kennzeichnungspflichten.
Der Hinweis steht auf `/ki-transparenz`, ist aber nirgends bestätigt.
Gehört in die AGB.
