"use client";

import { useState } from "react";
import { SiteNav, SiteFooter } from "./SiteChrome";

/* ═══════════════════════════════════════════════════════════════════
   ACHTUNG — das hier ist ein Geruest, keine Rechtsberatung.

   Alle Angaben in eckigen Klammern sind Platzhalter und muessen vor der
   Veroeffentlichung durch geprüfte Inhalte ersetzt werden. Besonders die
   Abschnitte "Verarbeitung durch KI-Anbieter" und "Speicherort und
   Auftragsverarbeiter" muessen mit der Kanzlei ausformuliert werden,
   einschliesslich Drittlandübermittlung nach Art. 44 ff. DSGVO — die
   Agenten laufen bei Anthropic in den USA, die Datenbank in eu-central-1.
   ═══════════════════════════════════════════════════════════════════ */

const STAND = "18. August 2026";

type Block = { title: string; text: string; items?: string[] };
type Dok = { key: "impressum" | "datenschutz"; label: string; title: string; lead: string; blocks: Block[] };

const IMPRESSUM: Dok = {
  key: "impressum",
  label: "Impressum",
  title: "Impressum",
  lead: "Angaben gemäß § 5 DDG und § 18 Abs. 2 MStV.",
  blocks: [
    { title: "Anbieter", text: "[Firmenname], [Rechtsform], [Straße und Hausnummer], [PLZ Ort], Deutschland." },
    { title: "Vertreten durch", text: "[Name der vertretungsberechtigten Person], [Funktion]." },
    { title: "Kontakt", text: "Telefon [Nummer], E-Mail hallo@kana-ai.de. Produktanfragen beantworten wir werktags zeitnah." },
    { title: "Registereintrag", text: "Eingetragen im Handelsregister des Amtsgerichts [Ort], Registernummer [HRB …]. Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: [DE …]." },
    { title: "Verantwortlich für den Inhalt", text: "[Name], [Adresse]. Redaktionelle Verantwortung nach § 18 Abs. 2 MStV." },
    { title: "Streitschlichtung", text: "Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. [Von Kanzlei prüfen lassen.]" },
    { title: "Haftung für Inhalte und Verweise", text: "Für eigene Inhalte sind wir nach den allgemeinen Gesetzen verantwortlich. Für Inhalte verlinkter Seiten übernehmen wir keine Gewähr; verantwortlich ist jeweils deren Anbieter." },
  ],
};

const DATENSCHUTZ: Dok = {
  key: "datenschutz",
  label: "Datenschutz",
  title: "Datenschutzerklärung",
  lead: "Diese Erklärung beschreibt, welche Daten bei der Nutzung von KANA AI verarbeitet werden, zu welchem Zweck und wie lange.",
  blocks: [
    { title: "Verantwortlicher", text: "[Firmenname], [Adresse], erreichbar unter hallo@kana-ai.de. Datenschutzbeauftragte Stelle: [Angabe oder Hinweis, dass keine Bestellpflicht besteht]." },
    { title: "Welche Daten wir verarbeiten", text: "Wir verarbeiten Daten, die für Zugang, Betrieb und Abrechnung nötig sind:", items: [
      "Zugangsdaten: Name, Firma, E-Mail-Adresse, Passwort-Hash",
      "Inhalte: deine Eingaben im Chat, hochgeladene Dateien, erzeugte Ergebnisse",
      "Nutzungsdaten: Sitzungen, Laufzeiten, Verbrauch — Grundlage der Abrechnung",
      "Abrechnungsdaten: über den Zahlungsdienstleister [Stripe Payments Europe Ltd.]",
    ] },
    { title: "Rechtsgrundlagen", text: "Verarbeitung zur Vertragserfüllung nach Art. 6 Abs. 1 lit. b DSGVO, zur Erfüllung rechtlicher Pflichten nach lit. c und auf Grundlage berechtigter Interessen nach lit. f, etwa zur Sicherung des Betriebs." },
    { title: "Verarbeitung durch KI-Anbieter", text: "Zur Erbringung der Leistung werden Inhalte an Anbieter von Sprachmodellen übermittelt. [Anbieter, Standort der Verarbeitung und Rechtsgrundlage der Übermittlung hier konkret benennen — auch mögliche Drittlandübermittlung nach Art. 44 ff. DSGVO.] Wie die Ergebnisse entstehen, welche Grenzen sie haben und wofür wir einstehen, steht unter KI-Transparenz und Haftung.", items: [
      "Kennzeichnung und Grenzen der Ergebnisse: /ki-transparenz",
    ] },
    { title: "Speicherort und Auftragsverarbeiter", text: "Datenbank und Ablage laufen bei [Anbieter, Region]. Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO.", items: [
      "[Hosting und Datenbank: Anbieter, Region]",
      "[Modellanbieter: Anbieter, Region]",
      "[Zahlungsdienstleister: Anbieter, Region]",
    ] },
    { title: "Speicherdauer", text: "Zugangsdaten löschen wir nach Beendigung des Vertrags, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Sitzungen und erzeugte Dateien bleiben bis zur Löschung durch dich im Arbeitsbereich." },
    { title: "Deine Rechte", text: "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem kannst du dich bei einer Aufsichtsbehörde beschweren.", items: [
      "Auskunft und Kopie deiner Daten: Anfrage an hallo@kana-ai.de",
      "Löschung des Arbeitsbereichs: über die Abrechnung im Portal oder per Anfrage",
      "Zuständige Aufsichtsbehörde: [Behörde des Bundeslandes]",
    ] },
    { title: "Cookies und Reichweitenmessung", text: "Wir setzen technisch notwendige Cookies für die Anmeldung. [Falls Analyse- oder Marketing-Werkzeuge eingesetzt werden: hier benennen und Einwilligung nach § 25 TDDDG einholen.]" },
  ],
};

const DOKS = [IMPRESSUM, DATENSCHUTZ];
const num = (i: number) => String(i + 1).padStart(2, "0");

export default function RechtSeite({ start }: { start: "impressum" | "datenschutz" }) {
  const [doc, setDoc] = useState<"impressum" | "datenschutz">(start);
  const cur = DOKS.find((d) => d.key === doc) ?? IMPRESSUM;

  return (
    <div className="landing">
      <SiteNav aktiv="recht" />

      <div className="recht-tabs">
        {DOKS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`recht-tab${doc === d.key ? " active" : ""}`}
            aria-current={doc === d.key ? "page" : undefined}
            onClick={() => setDoc(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="recht-layout">
        <aside className="recht-toc">
          <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Inhalt</span>
          <ol style={{ display: "flex", flexDirection: "column", listStyle: "none" }}>
            {cur.blocks.map((b, i) => (
              <li key={b.title} className="recht-toc__row">
                <span className="mono-num" style={{ color: "var(--text-muted)" }}>{num(i)}</span>
                <a href={`#abschnitt-${num(i)}`}>{b.title}</a>
              </li>
            ))}
          </ol>
          <div className="recht-toc__foot">
            <span className="mono-num" style={{ color: "var(--text-muted)" }}>Stand</span>
            <span className="t-ui" style={{ color: "var(--text-secondary)" }}>{STAND}</span>
          </div>
        </aside>

        <article className="recht-text">
          <h1 className="t-h2" style={{ marginBottom: 14 }}>{cur.title}</h1>
          <p className="t-lead" style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 36 }}>{cur.lead}</p>

          {cur.blocks.map((b, i) => (
            <section key={b.title} id={`abschnitt-${num(i)}`} style={{ marginBottom: 32, scrollMarginTop: 100 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                <span className="mono-num" style={{ color: "var(--accent)" }}>{num(i)}</span>
                <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em" }}>{b.title}</h2>
              </div>
              <p className="recht-p">{b.text}</p>
              {b.items?.map((t) => (
                <div key={t} className="recht-item">
                  <span className="recht-item__dot" />
                  <span>{t}</span>
                </div>
              ))}
            </section>
          ))}

          <p className="recht-hinweis">
            Angaben in eckigen Klammern sind Platzhalter und müssen vor Veröffentlichung durch
            geprüfte Inhalte ersetzt werden.
          </p>
        </article>
      </div>

      <SiteFooter />
    </div>
  );
}
