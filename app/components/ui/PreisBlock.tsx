"use client";

import { eur } from "@/lib/abteilungen";
import Betrag from "./Betrag";

/* Der Preisblock einer Tarifkarte.

   Grundsatz: der Kunde soll keinen Betrag selbst ausrechnen muessen. Deshalb
   stehen hier immer drei Dinge untereinander — der Monatsbeitrag, die
   einmalige Einrichtung, und die Summe, die im ersten Monat tatsaechlich
   abgebucht wird. Die Einrichtung in der Fussnote zu verstecken waere
   genau die Praxis, die spaeter Rueckfragen und Aerger erzeugt.

   setup === null bedeutet "noch nicht festgelegt" und wird als "nach
   Aufwand" ausgewiesen, setup === 0 heisst "faellt nicht an" und
   verschwindet ganz. */

interface Props {
  /** Monatsbeitrag. null = kein Betrag hinterlegt */
  monat: number | null;
  /** Einmalige Einrichtung. null = nach Aufwand, 0 = keine */
  setup: number | null;
  einheit: string;
  /** "ab" davorsetzen — bei Einstiegstarifen */
  ab?: boolean;
  /** Text statt Betrag, z.B. "individuell" */
  stattBetrag?: string;
}

export default function PreisBlock({ monat, setup, einheit, ab = false, stattBetrag }: Props) {
  const zeigtSetup = setup === null || setup > 0;
  const ersterMonat = monat !== null && setup !== null ? monat + setup : null;

  return (
    <div className="preisblock">
      <div className="preisblock__zeile">
        <span className="plan__amount">
          {stattBetrag
            ? stattBetrag
            : monat === null
              ? "—"
              : <>{ab && "ab "}<Betrag wert={monat} /></>}
        </span>
        <span className="plan__unit">{einheit}</span>
      </div>

      {zeigtSetup && !stattBetrag && (
        <div className="preisblock__setup">
          <span className="preisblock__plus">+</span>
          <span>
            {setup === null
              ? <>Einrichtung <strong>nach Aufwand</strong></>
              : <><strong>{eur(setup)}</strong> einmalig für die Einrichtung</>}
          </span>
        </div>
      )}

      {ersterMonat !== null && (
        <div className="preisblock__summe">
          <span>Im ersten Monat</span>
          <span className="mono-num preisblock__summe-wert">{eur(ersterMonat)}</span>
        </div>
      )}
    </div>
  );
}
