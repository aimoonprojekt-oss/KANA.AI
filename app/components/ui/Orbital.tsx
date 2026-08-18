"use client";

/* Radiales Orbital — Kern = KANA, erste Bahn = Abteilungen, zweite Bahn = Agents.
   Geometrie ist reine Berechnung, kein SVG.

   Verwendet in Landingpage (klickbares Menue) und Portal Agents (Lagebild).
   Die drei Maszsaetze stehen im Handoff; sie werden ueber die Props gesetzt.

   Alle klickbaren Teile sind echte <button>s — im Entwurf waren es divs mit
   onClick, das ist hier bewusst nachgezogen. */

export type OrbitalAgent = {
  id: string;
  name: string;
  owned?: boolean;
};

export type OrbitalDept = {
  id: string;
  name: string;
  /** Marketing -90 (oben), Vertrieb 0 (rechts), IT 90 (unten), Content 180 (links) */
  angle: number;
  agents: OrbitalAgent[];
};

interface Props {
  depts: OrbitalDept[];
  size: number;
  coreR: number;
  rInner: number;
  rOuter: number;
  spread?: number;
  activeDept: string;
  onDeptChange?: (id: string) => void;
  /** Portal: ausgewaehlter Agent bekommt einen Ring */
  selectedAgent?: string | null;
  onAgentSelect?: (id: string) => void;
  /** Beschriftung der Agents ausblenden — im 350-px-Einsatz zu eng */
  showLabels?: boolean;
  labelSize?: number;
  /** Wie weit eine Beschriftung ueber den Rand der Flaeche hinausreichen darf.
      Im Entwurf ragen die linken Labels bewusst heraus; nur die Umgebung
      begrenzt sie. */
  labelRoom?: number;
  /** Harte Obergrenze, damit ein langer Datenbankname nicht die Spalte sprengt. */
  labelMax?: number;
  nodeSize?: number;
  nodePad?: string;
  /** Portal: gebuchte Agents gefuellt, nicht gebuchte hohl */
  markOwned?: boolean;
  coreLabel?: string;
  coreFontSize?: number;
}

const PETROL = "#1F4B45";

export default function Orbital({
  depts,
  size,
  coreR,
  rInner,
  rOuter,
  spread = 46,
  activeDept,
  onDeptChange,
  selectedAgent = null,
  onAgentSelect,
  showLabels = true,
  labelSize = 12,
  labelRoom = 120,
  labelMax = 165,
  nodeSize = 15,
  nodePad = "10px 17px",
  markOwned = false,
  coreLabel = "KANA",
  coreFontSize = 15,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="orbital" style={{ width: size, height: size }}>
      <div
        className="orbital__track orbital__track--outer"
        style={{ width: rOuter * 2, height: rOuter * 2 }}
      />
      <div
        className="orbital__track orbital__track--inner"
        style={{ width: rInner * 2, height: rInner * 2 }}
      />

      {depts.map((d) => {
        const on = d.id === activeDept;
        const rad = (d.angle * Math.PI) / 180;
        const dx = cx + rInner * Math.cos(rad);
        const dy = cy + rInner * Math.sin(rad);
        const n = d.agents.length;

        return (
          <div key={d.id}>
            <div
              className="orbital__spoke"
              style={{
                left: cx + coreR * Math.cos(rad),
                top: cy + coreR * Math.sin(rad),
                width: rInner - coreR,
                height: on ? 2 : 1,
                background: on ? PETROL : "rgba(31,75,69,0.22)",
                transform: `rotate(${d.angle}deg)`,
              }}
            />

            {d.agents.map((a, i) => {
              const ang = d.angle - spread / 2 + (spread / (n - 1 || 1)) * i;
              const ar = (ang * Math.PI) / 180;
              const ax = cx + rOuter * Math.cos(ar);
              const ay = cy + rOuter * Math.sin(ar);
              const len = Math.hypot(ax - dx, ay - dy);
              const lineAng = (Math.atan2(ay - dy, ax - dx) * 180) / Math.PI;
              const right = ax >= cx;
              const isSel = on && a.id === selectedAgent;
              const owned = markOwned ? a.owned === true : true;
              const r = isSel ? 7 : owned ? 6 : 5;

              return (
                <div key={a.id}>
                  <div
                    className="orbital__line"
                    style={{
                      left: dx, top: dy, width: len,
                      background: on ? "rgba(31,75,69,0.45)" : "rgba(20,24,26,0.12)",
                      transform: `rotate(${lineAng}deg)`,
                    }}
                  />
                  <button
                    type="button"
                    className="orbital__dot"
                    aria-label={a.name}
                    aria-pressed={isSel}
                    onClick={() => onAgentSelect?.(a.id)}
                    disabled={!onAgentSelect}
                    style={{
                      left: ax, top: ay, width: r * 2, height: r * 2,
                      background: owned
                        ? on ? PETROL : "rgba(31,75,69,0.4)"
                        : "#FBFAF7",
                      border: owned
                        ? "none"
                        : `1px solid ${on ? "rgba(31,75,69,0.55)" : "rgba(20,24,26,0.3)"}`,
                      boxShadow: isSel ? "0 0 0 5px rgba(31,75,69,0.14)" : "none",
                      transform: "translate(-50%,-50%)",
                      cursor: onAgentSelect ? "pointer" : "default",
                    }}
                  />
                  {showLabels && (
                    /* Die Namen kommen aus der Datenbank und koennen beliebig
                       lang sein. Ohne Deckel ragen sie aus der Flaeche — das
                       war schon im Entwurf der haeufigste Fehler. Die Breite
                       ist deshalb auf den tatsaechlich freien Platz begrenzt,
                       der volle Name haengt im title. */
                    <span
                      className="orbital__label"
                      title={a.name}
                      style={{
                        left: ax + (right ? 12 : -12), top: ay,
                        transform: right ? "translateY(-50%)" : "translate(-100%,-50%)",
                        maxWidth: Math.min(labelMax, Math.max(70, (right ? size - ax : ax) - 12 + labelRoom)),
                        fontSize: labelSize,
                        fontWeight: isSel ? 700 : on ? 600 : 500,
                        color: isSel ? "#14181A" : on ? "#4A5250" : "#78807E",
                      }}
                    >
                      {a.name}
                    </span>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="orbital__node"
              aria-pressed={on}
              onClick={() => onDeptChange?.(d.id)}
              disabled={!onDeptChange}
              style={{
                left: dx, top: dy, transform: "translate(-50%,-50%)",
                padding: nodePad, fontSize: nodeSize,
                background: on ? PETROL : "#FBFAF7",
                color: on ? "#F6F4EF" : "#14181A",
                border: `1px solid ${on ? PETROL : "rgba(31,75,69,0.3)"}`,
                boxShadow: on ? "0 0 0 6px rgba(31,75,69,0.08)" : "none",
                cursor: onDeptChange ? "pointer" : "default",
              }}
            >
              {d.name}
            </button>
          </div>
        );
      })}

      <div
        className="orbital__core"
        style={{ width: coreR * 2, height: coreR * 2, fontSize: coreFontSize }}
      >
        {coreLabel}
      </div>
    </div>
  );
}
