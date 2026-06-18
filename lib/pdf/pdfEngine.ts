/**
 * Shared PDF rendering engine for KANA.AI agents.
 * White background, professional typography, agent-specific accent colors.
 */

export type RGB = readonly [number, number, number];

export interface AgentTheme {
  accent: RGB;
  accentLight: RGB;
  agentLabel: string;
}

export const THEMES = {
  brand:      { accent: [79, 70, 229],  accentLight: [238, 242, 255], agentLabel: "Brand Expert"        } as AgentTheme,
  analyst:    { accent: [37, 99, 235],  accentLight: [239, 246, 255], agentLabel: "Creative Analyst"    } as AgentTheme,
  strategist: { accent: [161, 120, 50], accentLight: [254, 249, 237], agentLabel: "Creative Strategist" } as AgentTheme,
}

// ─── Color constants ────────────────────────────────────────────────────────
export const WHITE:    RGB = [255, 255, 255]
export const BLACK:    RGB = [15,  15,  15]
export const GRAY900:  RGB = [30,  30,  30]
export const GRAY700:  RGB = [75,  75,  75]
export const GRAY500:  RGB = [120, 120, 120]
export const GRAY200:  RGB = [230, 230, 230]
export const GRAY100:  RGB = [248, 248, 248]
export const GREEN:    RGB = [22, 163, 74]
export const GREEN_BG: RGB = [240, 253, 244]
export const RED:      RGB = [220, 38,  38]
export const RED_BG:   RGB = [254, 242, 242]
export const AMBER:    RGB = [180, 110, 10]
export const AMBER_BG: RGB = [255, 251, 235]

// ─── PDF Page constants (A4 in pt) ─────────────────────────────────────────
export const PW = 595
export const PH = 842
export const ML = 52   // margin left
export const MR = 52   // margin right
export const CW = PW - ML - MR  // content width

/**
 * Build a jsPDF document with professional cover + content pages.
 * Returns the jsPDF instance ready to save.
 */
export async function buildPDF(opts: {
  theme:    AgentTheme
  title:    string
  subtitle: string
  date:     string
  sections: Array<{ heading: string; lines: ParsedLine[] }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })

  const { theme, title, subtitle, date, sections } = opts
  const { accent, accentLight, agentLabel } = theme

  // ── helpers ────────────────────────────────────────────────────────────────
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const ink  = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const rect = (x: number, y: number, w: number, h: number, c: RGB) => {
    fill(c); doc.rect(x, y, w, h, "F")
  }
  const line = (x1: number, y1: number, x2: number, y2: number, c: RGB, lw = 0.5) => {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(lw)
    doc.line(x1, y1, x2, y2)
  }
  const wrapText = (text: string, maxW: number): string[] => {
    if (!text.trim()) return [""]
    const words = text.split(" ")
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
      const test = cur ? cur + " " + w : w
      if (doc.getTextWidth(test) <= maxW) { cur = test }
      else { if (cur) lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : [text]
  }

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  rect(0, 0, PW, PH, WHITE)

  // Top band
  rect(0, 0, PW, 180, accent)
  // Diagonal accent strip
  rect(0, 0, 6, PH, accent)

  // Agent label (top band)
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); ink(WHITE)
  doc.text("KANA.AI  ·  " + agentLabel.toUpperCase(), ML, 44)

  // Sins 'n Lashes
  doc.setFont("helvetica", "bold"); doc.setFontSize(11)
  const snlW = doc.getTextWidth("SINS 'N LASHES")
  doc.text("SINS 'N LASHES", PW - MR - snlW, 44)

  // Title
  doc.setFontSize(30); ink(WHITE)
  doc.text(title, ML, 110)

  // Subtitle
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); ink([255, 255, 255])
  doc.setGState(new doc.GState({ opacity: 0.75 }))
  doc.text(subtitle, ML, 140)
  doc.setGState(new doc.GState({ opacity: 1 }))

  // Meta block
  const metaY = 220
  rect(ML, metaY, CW, 68, GRAY100)
  doc.setDrawColor(GRAY200[0], GRAY200[1], GRAY200[2]); doc.setLineWidth(0.5)
  doc.rect(ML, metaY, CW, 68, "S")

  ink(GRAY500); doc.setFontSize(8); doc.setFont("helvetica", "normal")
  doc.text("ERSTELLT AM",  ML + 16, metaY + 22)
  doc.text("AGENT",        ML + 140, metaY + 22)
  doc.text("PLATTFORM",    ML + 280, metaY + 22)

  ink(GRAY900); doc.setFontSize(10); doc.setFont("helvetica", "bold")
  doc.text(date,            ML + 16, metaY + 44)
  doc.text(agentLabel,      ML + 140, metaY + 44)
  doc.text("KANA.AI",       ML + 280, metaY + 44)

  // Footer cover
  ink(GRAY500); doc.setFont("helvetica", "normal"); doc.setFontSize(8)
  doc.text("Vertraulich · Erstellt für Sins 'n Lashes · KANA.AI", PW / 2, PH - 32, { align: "center" })
  line(ML, PH - 44, PW - MR, PH - 44, GRAY200)

  // ── CONTENT PAGES ──────────────────────────────────────────────────────────
  let pageNum = 2
  let y = 0

  const initPage = () => {
    doc.addPage()
    rect(0, 0, PW, PH, WHITE)
    rect(0, 0, 6, PH, accent)
    rect(0, 0, PW, 36, GRAY100)
    line(0, 36, PW, 36, GRAY200)

    // Header
    ink(GRAY500); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
    doc.text(`${agentLabel.toUpperCase()}  ·  SINS 'N LASHES  ·  ${date}`, ML + 10, 22)
    ink(GRAY500); doc.setFontSize(7.5)
    doc.text(String(pageNum), PW - MR, 22, { align: "right" })
    pageNum++

    // Footer
    line(ML, PH - 36, PW - MR, PH - 36, GRAY200)
    ink(GRAY500); doc.setFontSize(7)
    doc.text("Vertraulich · KANA.AI", PW / 2, PH - 22, { align: "center" })

    y = PH - 58
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < 58) initPage()
  }

  initPage()

  for (const section of sections) {
    if (!section.heading && section.lines.length === 0) continue

    // Section heading
    if (section.heading) {
      ensureSpace(50)
      rect(ML, y - 22, CW, 30, accent)
      ink(WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(10)
      doc.text(section.heading.slice(0, 80), ML + 12, y - 3)
      y -= 42
    }

    for (const pl of section.lines) {
      renderLine(doc, pl, accent, accentLight, wrapText, ensureSpace, rect, ink, line, { y: () => y, setY: (v: number) => { y = v } })
    }

    y -= 10 // spacing between sections
  }

  return doc
}

export type ParsedLine =
  | { type: "h2";      text: string }
  | { type: "h3";      text: string }
  | { type: "bullet";  text: string; indent?: number }
  | { type: "label";   label: string; value: string }
  | { type: "badge";   badge: string; color: "green" | "amber" | "red" | "blue"; text: string }
  | { type: "divider" }
  | { type: "score";   label: string; score: number; max: number }
  | { type: "body";    text: string; bold?: boolean; muted?: boolean }
  | { type: "blank" }

function renderLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  pl: ParsedLine,
  accent: RGB,
  accentLight: RGB,
  wrapText: (t: string, w: number) => string[],
  ensureSpace: (n: number) => void,
  rect: (x: number, y: number, w: number, h: number, c: RGB) => void,
  ink: (c: RGB) => void,
  drawLine: (x1: number, y1: number, x2: number, y2: number, c: RGB, lw?: number) => void,
  yRef: { y: () => number; setY: (v: number) => void }
) {
  const LH = 14
  const getY = () => yRef.y()
  const setY = (v: number) => yRef.setY(v)

  if (pl.type === "blank") { setY(getY() - 5); return }

  if (pl.type === "divider") {
    ensureSpace(14)
    drawLine(ML, getY() - 5, PW - MR, getY() - 5, GRAY200)
    setY(getY() - 14)
    return
  }

  if (pl.type === "h2") {
    ensureSpace(36)
    rect(ML, getY() - 20, CW, 26, accentLight)
    rect(ML, getY() - 20, 4, 26, accent)
    ink(accent); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5)
    doc.text(pl.text.slice(0, 90), ML + 12, getY() - 3)
    setY(getY() - 34)
    return
  }

  if (pl.type === "h3") {
    ensureSpace(26)
    rect(ML, getY() - 16, 4, 20, accent)
    ink(GRAY900); doc.setFont("helvetica", "bold"); doc.setFontSize(9)
    doc.text(pl.text.slice(0, 90), ML + 12, getY() - 1)
    setY(getY() - 24)
    return
  }

  if (pl.type === "bullet") {
    const indent = (pl.indent ?? 0) * 12
    const maxW = CW - 14 - indent
    const wrapped = wrapText(pl.text, maxW)
    ensureSpace(LH * wrapped.length + 2)
    ink(accent)
    doc.setFontSize(10)
    doc.text("•", ML + 8 + indent, getY() - 1)
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    wrapped.forEach((l, i) => doc.text(l, ML + 18 + indent, getY() - i * LH))
    setY(getY() - LH * wrapped.length - 1)
    return
  }

  if (pl.type === "label") {
    const wrapped = wrapText(pl.value, CW - 110)
    ensureSpace(LH * wrapped.length + 2)
    ink(GRAY500); doc.setFont("helvetica", "bold"); doc.setFontSize(8)
    doc.text(pl.label.slice(0, 20).toUpperCase() + ":", ML, getY() - 1)
    ink(GRAY900); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    wrapped.forEach((l, i) => doc.text(l, ML + 105, getY() - i * LH))
    setY(getY() - LH * wrapped.length - 1)
    return
  }

  if (pl.type === "badge") {
    const colors: Record<string, [RGB, RGB]> = {
      green: [GREEN,    GREEN_BG],
      amber: [AMBER,    AMBER_BG],
      red:   [RED,      RED_BG],
      blue:  [accent,   accentLight],
    }
    const [fg, bg] = colors[pl.color] ?? colors.blue
    const wrapped = wrapText(pl.text, CW - 52)
    ensureSpace(LH * wrapped.length + 4)
    rect(ML, getY() - 13, 44, 16, bg)
    ink(fg); doc.setFont("helvetica", "bold"); doc.setFontSize(7)
    doc.text(pl.badge.slice(0, 6).toUpperCase(), ML + 4, getY() - 3)
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    wrapped.forEach((l, i) => doc.text(l, ML + 52, getY() - i * LH))
    setY(getY() - LH * wrapped.length - 2)
    return
  }

  if (pl.type === "score") {
    ensureSpace(18)
    const pct = Math.min(pl.score / pl.max, 1)
    const barW = 120
    const scoreColor: RGB = pct >= 0.8 ? GREEN : pct >= 0.6 ? accent : pct >= 0.4 ? AMBER : RED
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    doc.text(pl.label, ML, getY() - 1)
    rect(ML + 160, getY() - 11, barW, 10, GRAY200)
    rect(ML + 160, getY() - 11, barW * pct, 10, scoreColor)
    ink(GRAY900); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5)
    doc.text(`${pl.score.toFixed(1)} / ${pl.max}`, ML + 160 + barW + 8, getY() - 2)
    setY(getY() - 16)
    return
  }

  // body (default)
  if (pl.type === "body") {
    const wrapped = wrapText(pl.text || " ", CW)
    ensureSpace(LH * wrapped.length + 1)
    ink(pl.muted ? GRAY500 : pl.bold ? GRAY900 : GRAY700)
    doc.setFont("helvetica", pl.bold ? "bold" : "normal")
    doc.setFontSize(pl.muted ? 8 : 8.5)
    wrapped.forEach((l, i) => doc.text(l, ML, getY() - i * LH))
    setY(getY() - LH * wrapped.length)
  }
}

/**
 * Parse raw markdown-ish agent output into typed ParsedLine[]
 */
export function parseAgentOutput(text: string): Array<{ heading: string; lines: ParsedLine[] }> {
  const sections: Array<{ heading: string; lines: ParsedLine[] }> = []
  let current: { heading: string; lines: ParsedLine[] } = { heading: "", lines: [] }

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    const t = line.trim()

    // Box drawing / decorative chars → skip
    if (/^[╔╗╚╝║═─]{3,}/.test(t) || t === "") {
      if (current.lines.length > 0 || t === "") current.lines.push({ type: "blank" })
      continue
    }

    // Section divider ─── HEADING ───
    const sectionMatch = t.match(/^─{2,}\s+(.+?)\s*─*$/)
    if (sectionMatch) {
      if (current.heading || current.lines.some(l => l.type !== "blank")) sections.push(current)
      current = { heading: sectionMatch[1].replace(/─+/g, "").trim(), lines: [] }
      continue
    }

    // Markdown ##
    if (t.startsWith("## ")) {
      current.lines.push({ type: "h2", text: t.slice(3) })
      continue
    }
    if (t.startsWith("### ")) {
      current.lines.push({ type: "h3", text: t.slice(4) })
      continue
    }
    if (t.startsWith("#### ")) {
      current.lines.push({ type: "h3", text: t.slice(5) })
      continue
    }

    // Score line: K1: 4.5/5.0 or Score: 4.2/5.0
    const scoreMatch = t.match(/^(K[1-6]|Score|Gesamt)[:\s]+(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
    if (scoreMatch) {
      current.lines.push({ type: "score", label: scoreMatch[1], score: parseFloat(scoreMatch[2]), max: parseFloat(scoreMatch[3]) })
      continue
    }

    // Badge: [NEU], [GEÄNDERT], [ABGELEITET], [ANALYST:...]
    const badgeMatch = t.match(/^\[(NEU|GEÄ?NDERT|CHANGED|ABGELEITET|ANALYST[^\]]*|EMPFEHLUNG)\]\s*(.*)/)
    if (badgeMatch) {
      const badge = badgeMatch[1].startsWith("ANALYST") ? "ANLST" : badgeMatch[1].slice(0, 6)
      const color = badgeMatch[1] === "NEU" ? "green" : badgeMatch[1].startsWith("GE") || badgeMatch[1] === "CHANGED" ? "amber" : "blue"
      current.lines.push({ type: "badge", badge, color, text: badgeMatch[2] })
      continue
    }

    // Label: Key: Value (short key, colon, rest)
    const labelMatch = t.match(/^([A-ZÄÖÜ][a-zA-ZÄÖÜäöüß\s\-]{2,25}):\s+(.{4,})$/)
    if (labelMatch && !t.startsWith("-") && !t.startsWith("•")) {
      current.lines.push({ type: "label", label: labelMatch[1], value: labelMatch[2] })
      continue
    }

    // Bullet
    if (t.startsWith("- ") || t.startsWith("• ") || t.startsWith("· ")) {
      const indent = Math.floor((line.length - line.trimStart().length) / 2)
      current.lines.push({ type: "bullet", text: t.slice(2), indent })
      continue
    }
    if (/^\d+\.\s/.test(t)) {
      current.lines.push({ type: "bullet", text: t.replace(/^\d+\.\s/, ""), indent: 0 })
      continue
    }

    // Horizontal rule
    if (/^[-─═]{4,}$/.test(t)) {
      current.lines.push({ type: "divider" })
      continue
    }

    // Bold line **text** or *text*
    if (/^\*\*[^*]+\*\*$/.test(t)) {
      current.lines.push({ type: "body", text: t.replace(/\*\*/g, ""), bold: true })
      continue
    }

    // Muted / small: lines starting with _ or indented
    if (t.startsWith("_") && t.endsWith("_")) {
      current.lines.push({ type: "body", text: t.slice(1, -1), muted: true })
      continue
    }

    // Default body
    current.lines.push({ type: "body", text: t.replace(/\*\*/g, "") })
  }

  if (current.heading || current.lines.some(l => l.type !== "blank")) sections.push(current)
  return sections
}
