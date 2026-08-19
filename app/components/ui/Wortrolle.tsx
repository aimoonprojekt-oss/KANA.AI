"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Woerter auf einer Rolle: das aktive Wort schiebt nach oben aus dem
   Ausschnitt, das naechste kommt von unten nach.

   Die Breite wandert mit, sonst springt die zentrierte Zeile bei jedem
   Wechsel. Gemessen wird nach dem Laden der Schrift — vorher misst man
   die Ersatzschrift und die Zeile ruckt einmal.

   Bei prefers-reduced-motion steht das erste Wort still. */

export default function Wortrolle({
  woerter,
  intervall = 2400,
  className,
}: { woerter: string[]; intervall?: number; className?: string }) {
  const [i, setI] = useState(0);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % woerter.length), intervall);
    return () => clearInterval(id);
  }, [woerter.length, intervall]);

  return (
    <span
      className={`wortrolle${className ? " " + className : ""}`}
      style={{ width: breite }}
      /* Der Ausschnitt zeigt immer nur ein Wort — fuer Vorlesegeraete
         steht der ganze Satz einmal vollstaendig da. */
      aria-label={woerter.join(", ")}
    >
      <span className="wortrolle__track" style={{ transform: `translateY(-${i * 100}%)` }}>
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
  );
}
