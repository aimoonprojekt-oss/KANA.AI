/**
 * Shared PDF rendering engine for KANA.AI agents.
 * Top-to-bottom rendering, dark cover, professional section headers.
 */

export type RGB = readonly [number, number, number]

export interface AgentTheme {
  accent: RGB
  accentLight: RGB
  agentLabel: string
}

export const THEMES = {
  brand:      { accent: [220, 38,  38]  as RGB, accentLight: [254, 242, 242] as RGB, agentLabel: "Brand Expert"        },
  analyst:    { accent: [37,  99,  235] as RGB, accentLight: [239, 246, 255] as RGB, agentLabel: "Creative Analyst"    },
  strategist: { accent: [161, 120, 50]  as RGB, accentLight: [254, 249, 237] as RGB, agentLabel: "Creative Strategist" },
}

// ─── Color constants ────────────────────────────────────────────────────────
const WHITE:    RGB = [255, 255, 255]
const DARK_BG:  RGB = [18,  18,  18]
const GRAY900:  RGB = [30,  30,  30]
const GRAY700:  RGB = [75,  75,  75]
const GRAY500:  RGB = [120, 120, 120]
const GRAY300:  RGB = [200, 200, 200]
const GRAY200:  RGB = [230, 230, 230]
const GRAY100:  RGB = [248, 248, 248]
const RED:      RGB = [220, 38,  38]
const RED_BG:   RGB = [254, 242, 242]
const GREEN:    RGB = [22,  163, 74]
const GREEN_BG: RGB = [240, 253, 244]
const AMBER:    RGB = [180, 110, 10]
const AMBER_BG: RGB = [255, 251, 235]

// ─── Page geometry (A4 in pt) ────────────────────────────────────────────────
const PW     = 595
const PH     = 842
const ML     = 48    // margin left
const MR     = 48    // margin right
const CW     = PW - ML - MR
const HDR_H  = 32    // header band height
const CT     = HDR_H + 14  // content top (where body starts)
const CB     = PH - 44     // content bottom (where body ends)
const LH     = 14    // base line height

// ─── buildPDF ───────────────────────────────────────────────────────────────
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

  // ── helpers ───────────────────────────────────────────────
  const fill  = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const ink   = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const rect  = (x: number, y: number, w: number, h: number, c: RGB) => {
    fill(c); doc.rect(x, y, w, h, "F")
  }
  const hline = (x1: number, y1: number, x2: number, c: RGB, lw = 0.5) => {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(lw)
    doc.line(x1, y1, x2, y1)
  }
  const wrapText = (text: string, maxW: number): string[] => {
    if (!text.trim()) return [" "]
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

  // ── COVER PAGE ────────────────────────────────────────────
  rect(0, 0, PW, PH, DARK_BG)
  rect(0, 0, PW, 5, accent)

  // Top labels
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(GRAY500)
  doc.text("KANA.AI  ·  " + agentLabel.toUpperCase(), ML, 38)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(WHITE)
  const snlW = doc.getTextWidth("SINS 'N LASHES")
  doc.text("SINS 'N LASHES", PW - MR - snlW, 38)

  // Big title centered
  doc.setFont("helvetica", "bold"); doc.setFontSize(36); ink(WHITE)
  const titleW = doc.getTextWidth(title)
  doc.text(title, (PW - titleW) / 2, 260)

  // Subtitle in accent color
  doc.setFont("helvetica", "normal"); doc.setFontSize(14)
  doc.setTextColor(accent[0], accent[1], accent[2])
  const subW = doc.getTextWidth(subtitle)
  doc.text(subtitle, (PW - subW) / 2, 292)

  // Date muted
  doc.setFontSize(9); ink(GRAY500)
  const dateW = doc.getTextWidth(date)
  doc.text(date, (PW - dateW) / 2, 316)

  // Meta block
  const metaY = 390
  rect(ML, metaY, CW, 72, [28, 28, 28] as RGB)
  rect(ML, metaY, 4, 72, accent)
  ink(GRAY500); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
  doc.text("ERSTELLT AM", ML + 16, metaY + 18)
  doc.text("AGENT",       ML + 150, metaY + 18)
  doc.text("PLATTFORM",   ML + 290, metaY + 18)
  ink(WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(10)
  doc.text(date,          ML + 16,  metaY + 44)
  doc.text(agentLabel,    ML + 150, metaY + 44)
  doc.text("KANA.AI",     ML + 290, metaY + 44)

  // Footer
  hline(ML, PH - 46, PW - MR, GRAY900)
  ink(GRAY500); doc.setFont("helvetica", "normal"); doc.setFontSize(8)
  doc.text("Vertraulich · Erstellt für Sins 'n Lashes · KANA.AI", PW / 2, PH - 30, { align: "center" })

  // ── CONTENT PAGES ─────────────────────────────────────────
  let pageNum = 2
  let y = CT

  const newPage = () => {
    doc.addPage()
    rect(0, 0, PW, PH, WHITE)
    rect(0, 0, 4, PH, accent)
    rect(0, 0, PW, HDR_H, GRAY100)
    hline(0, HDR_H, PW, GRAY200)
    ink(GRAY500); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5)
    doc.text(`${agentLabel.toUpperCase()}  ·  SINS 'N LASHES  ·  ${date}`, ML + 8, 20)
    doc.text(String(pageNum), PW - MR, 20, { align: "right" })
    pageNum++
    hline(ML, PH - 28, PW - MR, GRAY200)
    ink(GRAY500); doc.setFontSize(7)
    doc.text("Vertraulich · KANA.AI", PW / 2, PH - 14, { align: "center" })
    y = CT
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > CB) newPage()
  }

  newPage()

  for (const section of sections) {
    if (!section.heading && section.lines.every(l => l.type === "blank")) continue

    // Section heading — dark bar with white text
    if (section.heading) {
      ensureSpace(40)
      rect(ML, y, CW, 28, GRAY900)
      ink(WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(10)
      doc.text(section.heading.slice(0, 85), ML + 10, y + 18)
      y += 28 + 10
    }

    for (const pl of section.lines) {
      renderLine(doc, pl, accent, accentLight, wrapText, ensureSpace, rect, ink, hline,
        { get: () => y, set: (v: number) => { y = v } })
    }

    y += 10
  }

  return doc
}

// ─── ParsedLine types ────────────────────────────────────────────────────────
export type ParsedLine =
  | { type: "h2";      text: string }
  | { type: "h3";      text: string }
  | { type: "bullet";  text: string; indent?: number }
  | { type: "label";   label: string; value: string }
  | { type: "badge";   badge: string; color: "green" | "amber" | "red" | "blue"; text: string }
  | { type: "divider" }
  | { type: "score";   label: string; score: number; max: number }
  | { type: "body";    text: string; bold?: boolean; muted?: boolean; italic?: boolean }
  | { type: "callout"; prefix: string; text: string; color: "red" | "amber" | "blue" }
  | { type: "quote";   text: string }
  | { type: "blank" }

// ─── renderLine ──────────────────────────────────────────────────────────────
// All y coordinates go TOP → DOWN. y is the TOP of the current element.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLine(
  doc: any,
  pl: ParsedLine,
  accent: RGB,
  accentLight: RGB,
  wrapText: (t: string, w: number) => string[],
  ensureSpace: (n: number) => void,
  rect: (x: number, y: number, w: number, h: number, c: RGB) => void,
  ink: (c: RGB) => void,
  hline: (x1: number, y: number, x2: number, c: RGB, lw?: number) => void,
  yRef: { get: () => number; set: (v: number) => void }
) {
  const get = yRef.get
  const set = yRef.set

  if (pl.type === "blank") {
    set(get() + 5)
    return
  }

  if (pl.type === "divider") {
    ensureSpace(14)
    hline(ML, get() + 6, PW - MR, GRAY200)
    set(get() + 14)
    return
  }

  if (pl.type === "h2") {
    ensureSpace(36)
    rect(ML,     get(), CW, 24, accentLight)
    rect(ML,     get(), 4,  24, accent)
    ink(accent); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5)
    doc.text(pl.text.slice(0, 90), ML + 12, get() + 16)
    set(get() + 24 + 8)
    return
  }

  if (pl.type === "h3") {
    ensureSpace(28)
    rect(ML, get(), 4, 20, accent)
    ink(GRAY900); doc.setFont("helvetica", "bold"); doc.setFontSize(9)
    doc.text(pl.text.slice(0, 90), ML + 12, get() + 13)
    set(get() + 20 + 8)
    return
  }

  if (pl.type === "bullet") {
    const indent = (pl.indent ?? 0) * 12
    const lines  = wrapText(pl.text, CW - 22 - indent)
    ensureSpace(LH * lines.length + 3)
    ink(accent); doc.setFontSize(12)
    doc.text("•", ML + 8 + indent, get() + 10)
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    lines.forEach((l, i) => doc.text(l, ML + 22 + indent, get() + 10 + i * LH))
    set(get() + LH * lines.length + 3)
    return
  }

  if (pl.type === "label") {
    const lines = wrapText(pl.value, CW - 112)
    ensureSpace(LH * lines.length + 3)
    ink(GRAY500); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5)
    doc.text((pl.label.slice(0, 22) + ":").toUpperCase(), ML, get() + 10)
    ink(GRAY900); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    lines.forEach((l, i) => doc.text(l, ML + 112, get() + 10 + i * LH))
    set(get() + LH * lines.length + 3)
    return
  }

  if (pl.type === "badge") {
    const colorMap: Record<string, [RGB, RGB]> = {
      green: [GREEN, GREEN_BG],
      amber: [AMBER, AMBER_BG],
      red:   [RED,   RED_BG],
      blue:  [accent, accentLight],
    }
    const [fg, bg] = colorMap[pl.color] ?? colorMap.blue
    const lines = wrapText(pl.text, CW - 56)
    ensureSpace(LH * lines.length + 6)
    rect(ML, get(), 48, 16, bg)
    ink(fg); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5)
    doc.text(pl.badge.slice(0, 8).toUpperCase(), ML + 4, get() + 10)
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    lines.forEach((l, i) => doc.text(l, ML + 56, get() + 10 + i * LH))
    set(get() + LH * lines.length + 4)
    return
  }

  if (pl.type === "score") {
    ensureSpace(20)
    const pct = Math.min(pl.score / pl.max, 1)
    const barW = 120
    const scoreColor: RGB = pct >= 0.8 ? GREEN : pct >= 0.6 ? accent : pct >= 0.4 ? AMBER : RED
    ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
    doc.text(pl.label, ML, get() + 12)
    rect(ML + 160, get() + 3, barW, 10, GRAY200)
    rect(ML + 160, get() + 3, barW * pct, 10, scoreColor)
    ink(GRAY900); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5)
    doc.text(`${pl.score.toFixed(1)} / ${pl.max}`, ML + 160 + barW + 8, get() + 12)
    set(get() + 20)
    return
  }

  if (pl.type === "callout") {
    const colorMap: Record<string, [RGB, RGB]> = {
      red:   [RED,   RED_BG],
      amber: [AMBER, AMBER_BG],
      blue:  [accent, accentLight],
    }
    const [borderC, bgC] = colorMap[pl.color] ?? colorMap.amber
    const fullText = pl.prefix ? pl.prefix + ": " + pl.text : pl.text
    const lines = wrapText(fullText, CW - 24)
    const blockH = LH * lines.length + 14
    ensureSpace(blockH + 8)
    rect(ML,     get(), 4,      blockH, borderC)
    rect(ML + 4, get(), CW - 4, blockH, bgC)
    // First line: bold prefix + normal rest
    if (pl.prefix && lines.length > 0) {
      const prefixFull = pl.prefix + ": "
      ink(borderC); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5)
      doc.text(prefixFull, ML + 12, get() + 11)
      const pw = doc.getTextWidth(prefixFull)
      const rest = lines[0].slice(prefixFull.length)
      if (rest) {
        ink(GRAY700); doc.setFont("helvetica", "normal")
        doc.text(rest, ML + 12 + pw, get() + 11)
      }
      ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
      lines.slice(1).forEach((l, i) => doc.text(l, ML + 12, get() + 11 + (i + 1) * LH))
    } else {
      ink(GRAY700); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5)
      lines.forEach((l, i) => doc.text(l, ML + 12, get() + 11 + i * LH))
    }
    set(get() + blockH + 6)
    return
  }

  if (pl.type === "quote") {
    const lines = wrapText(pl.text, CW - 26)
    const blockH = LH * lines.length + 12
    ensureSpace(blockH + 6)
    rect(ML, get(), 3, blockH, GRAY300)
    ink(GRAY500); doc.setFont("helvetica", "italic"); doc.setFontSize(8.5)
    lines.forEach((l, i) => doc.text(l, ML + 12, get() + 11 + i * LH))
    set(get() + blockH + 6)
    return
  }

  // body (default)
  if (pl.type === "body") {
    const lines = wrapText(pl.text || " ", CW)
    ensureSpace(LH * lines.length + 2)
    ink(pl.muted ? GRAY500 : pl.bold ? GRAY900 : GRAY700)
    doc.setFont("helvetica", pl.italic ? "italic" : pl.bold ? "bold" : "normal")
    doc.setFontSize(pl.muted ? 7.5 : 8.5)
    lines.forEach((l, i) => doc.text(l, ML, get() + 10 + i * LH))
    set(get() + LH * lines.length + 2)
  }
}

// ─── parseAgentOutput ────────────────────────────────────────────────────────
/**
 * Parse raw agent output text into structured sections + typed lines.
 * Handles %%% dividers, strips junk chars, recognizes callouts/quotes/badges.
 */
export function parseAgentOutput(text: string): Array<{ heading: string; lines: ParsedLine[] }> {
  const sections: Array<{ heading: string; lines: ParsedLine[] }> = []
  let current: { heading: string; lines: ParsedLine[] } = { heading: "", lines: [] }

  const push = (s: typeof current) => {
    if (s.heading || s.lines.some(l => l.type !== "blank")) sections.push(s)
  }

  // Strip rendering artifacts from a line
  const clean = (s: string) => s
    .replace(/^%Q\s*/g, "").replace(/\s*%Q\s*$/g, "")  // %Q box chars
    .replace(/!'|&þ|&amp;þ/g, "")                       // arrow/dagger artifacts
    .replace(/\*\*/g, "")                                // leftover bold markers
    .trim()

  for (const raw of text.split("\n")) {
    const trimmed = raw.trimEnd()
    const t = clean(trimmed)

    // Blank / empty line
    if (!t) {
      current.lines.push({ type: "blank" })
      continue
    }

    // Skip code fences and pure dash dividers
    if (t === "```" || t === "~~~" || /^---+$/.test(t)) continue

    // Skip box-drawing and decorative-only lines
    if (/^[╔╗╚╝║═─]{3,}/.test(t)) continue

    // %%% SECTION HEADING %%%
    const pctMatch = t.match(/^%%%+\s+(.+?)\s*%*$/)
    if (pctMatch) {
      push(current)
      current = { heading: pctMatch[1].replace(/%+/g, "").trim(), lines: [] }
      continue
    }

    // ─── SECTION HEADING ───
    const dashMatch = t.match(/^─{2,}\s+(.+?)\s*─*$/)
    if (dashMatch) {
      push(current)
      current = { heading: dashMatch[1].replace(/─+/g, "").trim(), lines: [] }
      continue
    }

    // ## H2
    if (t.startsWith("## ")) {
      current.lines.push({ type: "h2", text: t.slice(3) })
      continue
    }
    // ### or #### H3
    if (/^#{3,4}\s/.test(t)) {
      current.lines.push({ type: "h3", text: t.replace(/^#{3,4}\s+/, "") })
      continue
    }

    // Score: K1: 4.5/5.0
    const scoreMatch = t.match(/^(K[1-6]|Score|Gesamt)[:\s]+(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/)
    if (scoreMatch) {
      current.lines.push({ type: "score", label: scoreMatch[1], score: parseFloat(scoreMatch[2]), max: parseFloat(scoreMatch[3]) })
      continue
    }

    // Callout prefixes: NEU KW25:, HANDLUNGSBEDARF:, CHANCE:, RISIKO:, Empfehlung:, WICHTIG:, KRITISCH:
    const calloutMatch = t.match(/^(NEU\s+KW\d+|HANDLUNGSBEDARF|CHANCE\s+KW\d+|CHANCE|RISIKO\s+KW\d+|RISIKO|Empfehlung|Schnelltest|WICHTIG|KRITISCH|SOFORTMASSNAHME)[:\s]+(.+)/i)
    if (calloutMatch) {
      const prefix = calloutMatch[1].toUpperCase().trim()
      const body   = calloutMatch[2].trim()
      const color  = /RISIKO|KRITISCH/.test(prefix) ? "red" as const
                   : /NEU|CHANCE|SOFORT/.test(prefix) ? "blue" as const
                   : "amber" as const
      current.lines.push({ type: "callout", prefix, text: body, color })
      continue
    }

    // Quote: "..." or ""..."" (agent often wraps quotes in double quotes)
    const quoteMatch = t.match(/^[""](.+)[""]$/)
    if (quoteMatch) {
      current.lines.push({ type: "quote", text: quoteMatch[1] })
      continue
    }

    // Badge: [NEU], [GEÄNDERT], [CHANGED], [KW21], etc.
    const badgeMatch = t.match(/^\[(NEU|GE[ÄA]NDERT|CHANGED|ABGELEITET|ANALYST[^\]]*|EMPFEHLUNG|KW\d+)\]\s*(.*)/)
    if (badgeMatch) {
      const key  = badgeMatch[1]
      const body = badgeMatch[2]
      const badge = key.startsWith("GE") || key === "CHANGED" ? "GEÄ" : key.slice(0, 5)
      const color = key === "NEU" || /^KW/.test(key) ? "green" as const
                  : key.startsWith("GE") || key === "CHANGED" ? "amber" as const
                  : "blue" as const
      current.lines.push({ type: "badge", badge, color, text: body })
      continue
    }

    // Italic muted: *text* or _text_
    if (/^\*[^*].+[^*]\*$/.test(t) || /^_[^_].+[^_]_$/.test(t)) {
      current.lines.push({ type: "body", text: t.slice(1, -1), italic: true, muted: true })
      continue
    }

    // Bullet: -, •, ·, *
    if (/^[-•·]\s/.test(t) || /^\*\s/.test(t)) {
      const indent = Math.floor((raw.length - raw.trimStart().length) / 2)
      current.lines.push({ type: "bullet", text: t.slice(2).trim(), indent: Math.min(indent, 3) })
      continue
    }
    // Numbered: 1. 2. etc.
    if (/^\d+\.\s/.test(t)) {
      current.lines.push({ type: "bullet", text: t.replace(/^\d+\.\s+/, ""), indent: 0 })
      continue
    }
    // #1: ... style (agent list items)
    if (/^#\d+:\s/.test(t)) {
      current.lines.push({ type: "bullet", text: t.replace(/^#\d+:\s*/, ""), indent: 0 })
      continue
    }

    // Horizontal rule
    if (/^[-─═]{4,}$/.test(t)) {
      current.lines.push({ type: "divider" })
      continue
    }

    // Label: "Key: Value" (key up to ~28 chars, value at least 3 chars)
    const labelMatch = t.match(/^([A-ZÄÖÜa-zäöüß][^\n:]{1,26}):\s{1,3}(.{3,})$/)
    if (labelMatch && !t.startsWith("-") && !t.startsWith("•")) {
      current.lines.push({ type: "label", label: labelMatch[1], value: labelMatch[2] })
      continue
    }

    // Default body
    current.lines.push({ type: "body", text: t })
  }

  push(current)
  return sections
}
