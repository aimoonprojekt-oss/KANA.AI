"use client";

import { useEffect, useRef, useState } from "react";
import type { VerlaufPunkt } from "@/lib/platform/supabase";

/* Verlauf der genutzten Arbeitszeit aller Agents.
   x = Zeit (ein Punkt je Tag), y = summierte Arbeitszeit.

   Flaeche mit Linie, weil es um eine Entwicklung ueber die Zeit geht und
   die Summe darunter eine Bedeutung hat. Eine Reihe, deshalb keine
   Legende — die Ueberschrift benennt sie. Farbe ist die eine Akzentfarbe
   des Hauses; ein Kategorienschema mit mehreren Toenen gibt es hier
   bewusst nicht.

   Kein Diagramm-Paket: die Geometrie ist eine Handvoll Zeilen, und der
   Entwurf verlangt ohnehin Markup statt Bibliothek. */

const HOEHE = 200;
const PAD_OBEN = 16;
const PAD_UNTEN = 8;
/* Links Platz fuer die Achsenbeschriftung, rechts fuer die Haelfte des
   letzten Datums. Ohne den linken Rand liegen die Werte auf der Kurve. */
const PAD_LINKS = 56;
const PAD_RECHTS = 8;

function minutenText(m: number) {
  if (m <= 0) return "0 min";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

function tagKurz(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function tagLang(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "long" });
}

/** Obergrenze auf einen runden Wert aufziehen, damit die Achse lesbar ist. */
function achsenMaximum(max: number) {
  if (max <= 0) return 60;
  const stufen = [30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 2880, 5760];
  return stufen.find((s) => s >= max) ?? Math.ceil(max / 1440) * 1440;
}

export default function Verlaufsdiagramm({ punkte }: { punkte: VerlaufPunkt[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(720);
  const [aktiv, setAktiv] = useState<number | null>(null);

  /* Die Punkte werden in echten Pixeln gerechnet statt ueber ein
     skaliertes viewBox — sonst verzerrt die Flaeche auf breiten Fenstern. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const messen = () => setBreite(el.getBoundingClientRect().width || 720);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (punkte.length === 0) return null;

  const maxWert = Math.max(...punkte.map((p) => p.minuten));
  const yMax = achsenMaximum(maxWert);
  const plotBreite = Math.max(120, breite - PAD_LINKS - PAD_RECHTS);
  const plotHoehe = HOEHE - PAD_OBEN - PAD_UNTEN;
  const schritt = punkte.length > 1 ? plotBreite / (punkte.length - 1) : 0;

  const x = (i: number) => PAD_LINKS + i * schritt;
  const y = (m: number) => PAD_OBEN + plotHoehe - (m / yMax) * plotHoehe;

  const linie = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.minuten).toFixed(1)}`).join(" ");
  const flaeche = `${linie} L${x(punkte.length - 1).toFixed(1)},${(PAD_OBEN + plotHoehe).toFixed(1)} L${x(0).toFixed(1)},${(PAD_OBEN + plotHoehe).toFixed(1)} Z`;

  const gesamt = punkte.reduce((s, p) => s + p.minuten, 0);
  const gitter = [0, 0.25, 0.5, 0.75, 1];

  /* Beschriftung der x-Achse ausduennen, sonst kleben 30 Datumsangaben
     aneinander. */
  const abstand = Math.max(1, Math.ceil(punkte.length / 6));
  const xLabels = punkte
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % abstand === 0 || i === punkte.length - 1);

  function beiBewegung(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD_LINKS;
    const i = schritt > 0 ? Math.round(px / schritt) : 0;
    setAktiv(Math.min(punkte.length - 1, Math.max(0, i)));
  }

  const a = aktiv !== null ? punkte[aktiv] : null;

  return (
    <div className="diagramm">
      <div className="diagramm__kopf">
        <div>
          <div className="stat-label-small">Arbeitszeit aller Agents</div>
          <div className="stat-val">{minutenText(gesamt)}</div>
          <div className="stat-change">in den letzten {punkte.length} Tagen</div>
        </div>
      </div>

      <div className="diagramm__flaeche" ref={boxRef}>
        {/* y-Achse: liegt als HTML ueber dem SVG, damit die Mono-Schrift
            exakt in ihrer Groesse steht und nicht mitskaliert. */}
        <div className="diagramm__y" aria-hidden="true">
          {[...gitter].reverse().map((g) => (
            <span key={g} className="diagramm__y-wert" style={{ top: y(yMax * g) - 6 }}>
              {minutenText(Math.round(yMax * g))}
            </span>
          ))}
        </div>

        <svg
          width="100%"
          height={HOEHE}
          role="img"
          aria-label={`Verlauf der Arbeitszeit aller Agents über ${punkte.length} Tage. Insgesamt ${minutenText(gesamt)}.`}
          onMouseMove={beiBewegung}
          onMouseLeave={() => setAktiv(null)}
        >
          {gitter.map((g) => (
            <line
              key={g}
              x1={PAD_LINKS} x2={PAD_LINKS + plotBreite}
              y1={y(yMax * g)} y2={y(yMax * g)}
              stroke={g === 0 ? "rgba(20,24,26,0.18)" : "rgba(20,24,26,0.06)"}
              strokeWidth="1" shapeRendering="crispEdges"
            />
          ))}

          <path d={flaeche} fill="rgba(31,75,69,0.10)" />
          <path
            d={linie} fill="none"
            stroke="var(--accent)" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {a && aktiv !== null && (
            <>
              <line
                x1={x(aktiv)} x2={x(aktiv)} y1={PAD_OBEN} y2={PAD_OBEN + plotHoehe}
                stroke="rgba(31,75,69,0.35)" strokeWidth="1" shapeRendering="crispEdges"
              />
              {/* Ring in Flaechenfarbe, damit der Punkt auf der Linie steht
                  und nicht darin verschwindet. */}
              <circle cx={x(aktiv)} cy={y(a.minuten)} r="6" fill="var(--bg-primary)" />
              <circle cx={x(aktiv)} cy={y(a.minuten)} r="4.5" fill="var(--accent)" />
            </>
          )}
        </svg>

        {a && aktiv !== null && (
          <div
            className="diagramm__tooltip"
            style={{
              left: Math.min(Math.max(x(aktiv), PAD_LINKS + 60), PAD_LINKS + plotBreite - 60),
              top: Math.max(0, y(a.minuten) - 66),
            }}
          >
            <span className="diagramm__tooltip-tag">{tagLang(a.tag)}</span>
            <span className="diagramm__tooltip-wert">{minutenText(a.minuten)}</span>
            <span className="diagramm__tooltip-meta">
              {a.sitzungen} {a.sitzungen === 1 ? "Sitzung" : "Sitzungen"}
            </span>
          </div>
        )}
      </div>

      <div className="diagramm__x" aria-hidden="true">
        {xLabels.map(({ p, i }) => (
          <span
            key={p.tag}
            className="diagramm__x-wert"
            style={{
              left: x(i),
              /* Randbeschriftungen buendig statt zentriert, sonst haengen
                 sie links und rechts aus der Karte heraus. */
              transform:
                i === 0 ? "translateX(0)"
                : i === punkte.length - 1 ? "translateX(-100%)"
                : "translateX(-50%)",
            }}
          >
            {tagKurz(p.tag)}
          </span>
        ))}
      </div>

      {/* Dieselben Zahlen als Tabelle — fuer Vorlesegeraete und fuer alle,
          die die Kurve nicht ablesen koennen oder wollen. */}
      <details className="diagramm__tabelle">
        <summary>Zahlen als Tabelle</summary>
        <table>
          <thead>
            <tr><th>Tag</th><th>Arbeitszeit</th><th>Sitzungen</th></tr>
          </thead>
          <tbody>
            {punkte.map((p) => (
              <tr key={p.tag}>
                <td>{tagLang(p.tag)}</td>
                <td>{minutenText(p.minuten)}</td>
                <td>{p.sitzungen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
