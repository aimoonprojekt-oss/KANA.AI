"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Woerter auf einer Rolle: das aktive Wort schiebt nach oben aus dem
   Ausschnitt, das naechste kommt von unten nach.

   Die Breite wandert mit, sonst springt die zentrierte Zeile bei jedem
   Wechsel. Gemessen wird nach dem Laden der Schrift — vorher misst man
   die Ersatzschrift und die Zeile ruckt einmal.

   Bei prefers-reduced-motion steht das erste Wort still. */

interface Props {
  woerter: readonly string[];
  /** Von aussen gesteuert. Dann laeuft kein eigener Taktgeber — noetig,
      damit zwei Rollen synchron umschlagen. */
  index?: number;
  intervall?: number;
  className?: string;
}

export default function Wortrolle({ woerter, index, intervall = 2400, className }: Props) {
  const [eigenerIndex, setEigenerIndex] = useState(0);
  const gesteuert = index !== undefined;
  const i = gesteuert ? Math.min(Math.max(index, 0), woerter.length - 1) : eigenerIndex;

  const [breite, setBreite] = useState<number | undefined>(undefined);
  const woerterRef = useRef<(HTMLSpanElement | null)[]>([]);

  useLayoutEffect(() => {
    const messen = () => {
      const el = woerterRef.current[i];
      if (el) setBreite(el.getBoundingClientRect().width);
    };
    messen();
    window.addEventListener("resize", messen);
    document.fonts?.ready.then(messen).catch(() => {});
    return () => window.removeEventListener("resize", messen);
  }, [i]);

  useEffect(() => {
    if (gesteuert) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setEigenerIndex((v) => (v + 1) % woerter.length), intervall);
    return () => clearInterval(id);
  }, [gesteuert, woerter.length, intervall]);

  return (
    <span
      className={`wortrolle${className ? " " + className : ""}`}
      style={{ width: breite }}
      /* Die Rolle ist fuer Vorlesegeraete unsichtbar. Der vollstaendige
         Satz steht einmal als sr-only neben der Ueberschrift. */
      aria-hidden="true"
    >
      {/* Das Fenster schneidet ab, der Balken liegt darunter beim Elternteil —
          sonst faehrt er den Unterlaengen ins Gesicht (das g von Marketing). */}
      <span className="wortrolle__fenster">
        {/* Verschoben wird um GENAU eine Worthoehe je Schritt. Prozent waere
            hier falsch: die beziehen sich auf die Hoehe des ganzen Stapels,
            bei drei Woertern also auf das Dreifache — der Ausschnitt bliebe
            leer. --wortrolle-hoehe steht in globals.css und gilt fuer beide. */}
        <span
          className="wortrolle__track"
          style={{ transform: `translateY(calc(${-i} * var(--wortrolle-hoehe)))` }}
        >
          {woerter.map((w, idx) => (
            <span
              key={w}
              ref={(el) => { woerterRef.current[idx] = el; }}
              className="wortrolle__wort"
              aria-hidden={idx !== i}
            >
              {w}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
