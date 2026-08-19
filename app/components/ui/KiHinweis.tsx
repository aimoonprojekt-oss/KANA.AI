/* Kennzeichnung nach Art. 50 KI-VO (EU AI Act), in Kraft seit 02.08.2026.

   Abs. 1 verlangt vom Anbieter eines Systems, das unmittelbar mit
   Menschen interagiert, den Hinweis, dass es sich um ein KI-System
   handelt — es sei denn, das ist ohnehin offensichtlich. Abs. 5 verlangt
   den Hinweis "spaetestens zum Zeitpunkt der ersten Interaktion",
   "klar und erkennbar" und barrierefrei.

   Deshalb steht der Hinweis dort, wo die Interaktion beginnt: im leeren
   Chat, ueber dem Eingabefeld, in der Support-Blase — und nicht
   ausschliesslich auf einer Unterseite.

   ACHTUNG, offene Luecke: Abs. 2 verlangt zusaetzlich eine
   MASCHINENLESBARE Markierung der erzeugten Inhalte. Ein sichtbarer Satz
   erfuellt das nicht. Was fehlt, steht in
   docs/ki-verordnung-offene-punkte.md — bewusst dort und nicht auf der
   oeffentlichen Seite. */

type Ton = "hell" | "dunkel";

export function KiHinweis({
  ton = "hell",
  lang = false,
}: { ton?: Ton; lang?: boolean }) {
  return (
    <p className={`ki-hinweis${ton === "dunkel" ? " is-dunkel" : ""}`}>
      <span className="ki-hinweis__marke" aria-hidden="true">KI</span>
      <span>
        {lang ? (
          <>
            Du arbeitest mit einem KI-System. Die Ergebnisse entstehen aus einem
            Sprachmodell, können Fehler enthalten und sind keine fachliche,
            rechtliche oder steuerliche Beratung.{" "}
            <strong>Prüfe sie, bevor du sie verwendest.</strong>
          </>
        ) : (
          <>
            KI-erzeugt — kann Fehler enthalten. Bitte vor der Verwendung prüfen.
          </>
        )}
      </span>
    </p>
  );
}

export default KiHinweis;
