/* Die rotierenden Paare der Hero-Ueberschrift.
   Zeile 1: "Dein {department}"   Zeile 2: "{action}"

   Hier kommen neue Abteilungen dazu — die Komponente muss dafuer nicht
   angefasst werden. Zwei Dinge beim Ergaenzen beachten:

   1. Das Verb muss konkret sein. "laeuft." stand hier frueher fuer alle
      Abteilungen und sagte deshalb nichts. Jeder Eintrag soll einen
      Beweis liefern, keine Huelse.
   2. Lange Verben ("schaltet Ads.") bestimmen die Breite der Ueberschrift.
      Nach dem Ergaenzen einmal auf einem schmalen Fenster nachsehen —
      umbrechen darf innerhalb eines Paares nichts. */

export const ROTATIONS = [
  { department: "Support",   action: "antwortet." },
  { department: "Sales",     action: "schließt ab." },
  { department: "Marketing", action: "schaltet Ads." },
] as const;

/** Anzeigedauer je Paar in Millisekunden. */
export const ROTATION_DAUER = 2800;

/** Der ganze Satz am Stueck — fuer Vorlesegeraete, die die Rolle
    nicht mitbekommen. */
export function rotationAlsSatz() {
  return ROTATIONS
    .map((r, i) => `${i === 0 ? "Dein" : "dein"} ${r.department} ${r.action.replace(/\.$/, "")}`)
    .join(", ") + ".";
}
