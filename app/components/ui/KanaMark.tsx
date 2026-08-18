/* KANA-Signet: drei konzentrische Teile aus reinen Kreisen.
   1. offener Bogen aussen — Oeffnung rechts, sichtbarer Bogen links neben dem Punkt
   2. duenner Innenring bei 60 % — faellt unter 20 px weg, sonst wird es matschig
   3. Kern bei 28 %

   Bewegung ist optional: still ist das Zeichen vollstaendig. */

type Variant = "accent" | "dark" | "mono" | "onaccent";
type Motion = "still" | "spin" | "busy";

interface Props {
  size?: number;
  variant?: Variant;
  motion?: Motion;
  /** Kern atmet — nur im Chat am Agentenzeichen */
  breathe?: boolean;
  className?: string;
}

export default function KanaMark({
  size = 26,
  variant = "accent",
  motion = "still",
  breathe = false,
  className = "",
}: Props) {
  const ring = Math.round(size * 0.6);
  const core = Math.round(size * 0.28);
  const stroke = size >= 40 ? 2 : 1.5;
  const showRing = size >= 20;

  const classes = [
    "kana-mark",
    variant !== "accent" ? `kana-mark--${variant}` : "",
    motion !== "still" ? `kana-mark--${motion}` : "",
    breathe ? "kana-mark--breathe" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes} style={{ width: size, height: size }} aria-hidden="true">
      <span className="kana-mark__arc" style={{ borderWidth: stroke }} />
      {showRing && <span className="kana-mark__ring" style={{ width: ring, height: ring }} />}
      <span className="kana-mark__core" style={{ width: core, height: core }} />
    </span>
  );
}

/** Zeichen + Wortlaut. Abstand ist die halbe Zeichenbreite. */
export function KanaLogo({
  size = 26,
  fontSize = 19,
  dark = false,
  motion = "still",
}: { size?: number; fontSize?: number; dark?: boolean; motion?: Motion }) {
  return (
    <span className="kana-logo" style={{ gap: Math.round(size / 2) }}>
      <KanaMark size={size} variant={dark ? "dark" : "accent"} motion={motion} />
      <span className={dark ? "wordmark on-dark" : "wordmark"} style={{ fontSize }}>
        KANA <span className="ai">AI</span>
      </span>
    </span>
  );
}
