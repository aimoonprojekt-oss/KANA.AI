"use client";

import Link from "next/link";
import { SiteNav, SiteFooter } from "./SiteChrome";

/* ═══════════════════════════════════════════════════════════════════
   ACHTUNG — Gerüst, keine Rechtsberatung.

   Der Aufbau folgt Art. 50 der KI-Verordnung (EU 2024/1689), dessen
   Transparenzpflichten seit dem 02.08.2026 gelten. Die Haftungsstufung
   ist die in Deutschland uebliche und haelt der AGB-Kontrolle nach
   § 307 BGB stand — ein pauschales "wir haften nicht" taete das nicht
   und fiele vor Gericht ersatzlos weg, mit unbegrenzter Haftung als
   Folge.

   Trotzdem: Diese Seite ersetzt keine AGB. Eine Haftungsbegrenzung wirkt
   vertraglich nur, wenn sie wirksam einbezogen ist — beim Kauf, nicht
   durch einen Link in der Fusszeile. Von der Kanzlei pruefen und in die
   AGB uebernehmen lassen.
   ═══════════════════════════════════════════════════════════════════ */

const STAND = "19. August 2026";

type Block = { titel: string; text: string; punkte?: string[] };

const ABSCHNITTE: Block[] = [
  {
    titel: "Du arbeitest mit einem KI-System",
    text: "KANA AI ist ein KI-System im Sinne der Verordnung (EU) 2024/1689 (KI-Verordnung). Jeder Agent im Portal arbeitet auf Grundlage eines großen Sprachmodells. Wo immer du im Portal mit einem Agenten sprichst — im Chat oder über die Support-Blase — sprichst du mit einer Maschine, nicht mit einem Menschen. Dieser Hinweis erfüllt Art. 50 Abs. 1 KI-VO und erscheint deshalb auch unmittelbar dort, wo die Unterhaltung beginnt.",
  },
  {
    titel: "Wie die Ergebnisse entstehen — und warum sie falsch sein können",
    text: "Ein Sprachmodell sagt Wort für Wort das wahrscheinlich passende Folgewort voraus. Es „weiß“ nichts und prüft nichts nach. Daraus folgen Eigenschaften, die sich nicht wegkonfigurieren lassen:",
    punkte: [
      "Ergebnisse können sachlich falsch sein, obwohl sie überzeugend formuliert sind.",
      "Quellen, Zahlen, Zitate und Namen können erfunden sein.",
      "Dieselbe Frage kann zu unterschiedlichen Zeitpunkten unterschiedliche Antworten liefern.",
      "Der Wissensstand des Modells endet zu einem bestimmten Zeitpunkt; aktuelle Entwicklungen fehlen, sofern der Agent sie nicht eigens abruft.",
      "Analysen von Wettbewerbern, Märkten oder Anzeigen sind Einschätzungen, keine Messwerte.",
    ],
  },
  {
    titel: "Was das für dich bedeutet",
    text: "Die Ergebnisse sind ein Entwurf, keine Entscheidung. Die inhaltliche Verantwortung für alles, was du aus dem Portal heraus verwendest, veröffentlichst oder weitergibst, bleibt bei dir.",
    punkte: [
      "Prüfe Ergebnisse, bevor du sie verwendest — besonders Zahlen, Quellen und rechtlich relevante Aussagen.",
      "Nichts, was ein Agent ausgibt, ist Rechts-, Steuer-, Finanz- oder medizinische Beratung.",
      "Veröffentlichst du KI-erzeugte Texte oder Werbemittel, treffen dich als Betreiber gegebenenfalls eigene Kennzeichnungspflichten aus Art. 50 Abs. 4 KI-VO. Die Ausnahme für redaktionell geprüfte Inhalte greift nur, wenn ein Mensch die Verantwortung übernommen hat.",
      "Setze keine Agenten für Entscheidungen ein, die Menschen unmittelbar in ihren Rechten betreffen, ohne dass ein Mensch sie prüft.",
    ],
  },
  {
    titel: "Wo die Verarbeitung stattfindet",
    text: "Die Agenten laufen bei einem Anbieter von Sprachmodellen; die Datenbank liegt in der EU. Welche Anbieter das im Einzelnen sind, in welchen Regionen sie verarbeiten und auf welcher Rechtsgrundlage eine etwaige Drittlandübermittlung nach Art. 44 ff. DSGVO erfolgt, steht in der Datenschutzerklärung. [Von der Kanzlei zu vervollständigen.]",
  },
  {
    titel: "Gewährleistung für Ergebnisse",
    text: "Wir schulden den Betrieb der Agenten und ihre Verfügbarkeit — nicht ein bestimmtes inhaltliches Ergebnis. Eine Gewähr für Richtigkeit, Vollständigkeit, Aktualität oder Eignung der erzeugten Inhalte für einen bestimmten Zweck können wir aus den oben genannten Gründen nicht übernehmen. Ebenso wenig sichern wir zu, dass ein Ergebnis frei von Rechten Dritter ist; die Prüfung vor einer Veröffentlichung obliegt dir.",
  },
  {
    titel: "Haftung",
    text: "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung einer wesentlichen Vertragspflicht — also einer Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst — und der Höhe nach begrenzt auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Im Übrigen ist die Haftung ausgeschlossen. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.",
    punkte: [
      "Nicht ersetzt werden insbesondere Schäden, die daraus entstehen, dass ein KI-Ergebnis ungeprüft verwendet wurde.",
      "Ein weitergehender Ausschluss wäre nach § 307 BGB unwirksam — auch zwischen Unternehmen — und würde im Streitfall ersatzlos entfallen. [Von der Kanzlei zu prüfen und in die AGB zu übernehmen.]",
    ],
  },
  {
    titel: "Menschliche Aufsicht und Beschwerden",
    text: "Du kannst jeden Lauf abbrechen, Ergebnisse verwerfen und einen Agenten jederzeit abbestellen. Wenn dir ein Ergebnis schädlich, diskriminierend oder offensichtlich falsch erscheint, melde es an hallo@kana-ai.de — wir gehen dem nach und schalten den betroffenen Agenten im Zweifel ab.",
  },
];

const num = (i: number) => String(i + 1).padStart(2, "0");

export default function KiTransparenz() {
  return (
    <div className="landing">
      <SiteNav />

      <div className="recht-tabs">
        <span className="recht-tab active">KI-Transparenz und Haftung</span>
      </div>

      <div className="recht-layout">
        <aside className="recht-toc">
          <span className="mono-sm" style={{ color: "var(--text-muted)" }}>Inhalt</span>
          <ol style={{ display: "flex", flexDirection: "column", listStyle: "none" }}>
            {ABSCHNITTE.map((b, i) => (
              <li key={b.titel} className="recht-toc__row">
                <span className="mono-num" style={{ color: "var(--text-muted)" }}>{num(i)}</span>
                <a href={`#ki-${num(i)}`}>{b.titel}</a>
              </li>
            ))}
          </ol>
          <div className="recht-toc__foot">
            <span className="mono-num" style={{ color: "var(--text-muted)" }}>Stand</span>
            <span className="t-ui" style={{ color: "var(--text-secondary)" }}>{STAND}</span>
          </div>
        </aside>

        <article className="recht-text">
          <h1 className="t-h2" style={{ marginBottom: 14 }}>KI-Transparenz und Haftung</h1>
          <p className="t-lead" style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>
            Diese Seite legt offen, dass und wie KANA AI künstliche Intelligenz einsetzt, welche
            Grenzen die Ergebnisse haben und wofür wir einstehen. Sie setzt die Transparenzpflichten
            aus Art. 50 der Verordnung (EU) 2024/1689 um, die seit dem 2. August 2026 gelten.
          </p>

          {ABSCHNITTE.map((b, i) => (
            <section key={b.titel} id={`ki-${num(i)}`} style={{ marginBottom: 32, scrollMarginTop: 100 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                <span className="mono-num" style={{ color: "var(--accent)" }}>{num(i)}</span>
                <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.025em" }}>{b.titel}</h2>
              </div>
              <p className="recht-p">{b.text}</p>
              {b.punkte?.map((t) => (
                <div key={t} className="recht-item">
                  <span className="recht-item__dot" />
                  <span>{t}</span>
                </div>
              ))}
            </section>
          ))}

          <p className="recht-hinweis">
            Diese Seite ist keine Rechtsberatung und ersetzt keine Allgemeinen Geschäftsbedingungen.
            Eine Haftungsbegrenzung wirkt vertraglich nur, wenn sie beim Vertragsschluss wirksam
            einbezogen wird — nicht durch einen Link in der Fußzeile. Angaben in eckigen Klammern
            sind Platzhalter. Ergänzend gilt die{" "}
            <Link href="/recht?doc=datenschutz" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Datenschutzerklärung
            </Link>.
          </p>
        </article>
      </div>

      <SiteFooter />
    </div>
  );
}
