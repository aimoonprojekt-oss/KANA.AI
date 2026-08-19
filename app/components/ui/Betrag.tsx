"use client";

import { useEffect, useRef, useState } from "react";

/* Zahl, die beim Wechsel weiterwandert statt zu springen.

   Die Idee stammt aus @number-flow/react, das Paket selbst braucht es hier
   nicht: eine kurze Interpolation in Mono-Ziffern reicht und bleibt so ruhig,
   wie der Entwurf es verlangt. Wer prefers-reduced-motion gesetzt hat,
   bekommt den Zielwert sofort. */

const DAUER = 420;

export default function Betrag({
  wert,
  className,
}: { wert: number; className?: string }) {
  const [zeige, setZeige] = useState(wert);
  const vonRef = useRef(wert);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const von = vonRef.current;
    if (ruhig || von === wert) {
      vonRef.current = wert;
      setZeige(wert);
      return;
    }

    const start = performance.now();
    const tick = (jetzt: number) => {
      const t = Math.min(1, (jetzt - start) / DAUER);
      // ease-out: schnell los, sanft ankommen
      const e = 1 - Math.pow(1 - t, 3);
      setZeige(Math.round(von + (wert - von) * e));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else vonRef.current = wert;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [wert]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {zeige.toLocaleString("de-DE")}&nbsp;€
    </span>
  );
}
