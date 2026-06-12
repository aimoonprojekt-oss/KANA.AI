import { auth } from '@clerk/nextjs/server'
import { isAdminUser } from '@/lib/platform/supabase'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

// Sins 'n Lashes brand colors (normalized 0–1)
const BG      = rgb(0.039, 0.039, 0.039)   // #0a0a0a
const WHITE   = rgb(1, 1, 1)
const ACCENT  = rgb(0.576, 0.200, 0.918)   // #9333ea
const MUTED   = rgb(0.533, 0.533, 0.533)   // #888888
const BORDER  = rgb(0.133, 0.133, 0.133)   // #222222
const GREEN   = rgb(0.133, 0.773, 0.369)   // #22c55e
const GREEN_BG = rgb(0.078, 0.322, 0.173)  // #14532d
const ORANGE  = rgb(0.976, 0.451, 0.086)   // #f97316
const ORANGE_BG = rgb(0.259, 0.078, 0.027) // #431407
const LIGHT   = rgb(0.867, 0.867, 0.867)   // #dddddd
const MED     = rgb(0.800, 0.800, 0.800)   // #cccccc
const HEADER_BG = rgb(0.067, 0.067, 0.067) // #111111

function getKW(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7)
}

function parseSections(text: string): { header: string; body: string }[] {
  const sections: { header: string; body: string }[] = []
  const lines = text.split('\n')
  let current: { header: string; body: string } | null = null

  for (const line of lines) {
    const stripped = line.replace(/[─═╔╗╚╝║]/g, '').trim()
    if (!stripped) continue

    if (line.match(/^─{3,}\s+[A-ZÄÖÜ]/)) {
      if (current) sections.push(current)
      current = { header: stripped.replace(/─+/g, '').trim(), body: '' }
      continue
    }
    if (line.match(/^[╔╚]/)) continue
    if (line.match(/^║\s+SINS/)) {
      if (current) sections.push(current)
      current = { header: 'TITEL', body: stripped }
      continue
    }
    if (line.match(/^║\s+KW/)) {
      if (current) current.body += '\n' + stripped
      continue
    }
    if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else {
      current = { header: '', body: line }
    }
  }
  if (current) sections.push(current)
  return sections.filter(s => s.body.trim())
}

// Wrap text to max width (in characters — rough but works for monospace-like layouts)
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId || !isAdminUser(userId)) {
    return new Response(JSON.stringify({ error: 'Kein Zugriff' }), { status: 403 })
  }

  const { reportText, reportDate, mode } = await req.json()
  if (!reportText) {
    return new Response(JSON.stringify({ error: 'reportText fehlt' }), { status: 400 })
  }

  const now       = reportDate ? new Date(reportDate) : new Date()
  const kw        = getKW(now)
  const dateStr   = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const isSetup   = mode === 'brand-setup'
  const filePrefix = isSetup ? 'Brand_Setup_Report' : 'Brand_Weekly_Update'
  const fileName  = `${filePrefix}_${now.toISOString().slice(0, 10)}.pdf`

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Sins 'n Lashes — Brand Intelligence Report KW${kw}`)
  pdfDoc.setAuthor('KANA.AI Brand Expert')

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const A4W = 595
  const A4H = 842
  const M   = 50
  const CW  = A4W - M * 2

  // ── COVER PAGE ──────────────────────────────────────────────────
  const cover = pdfDoc.addPage([A4W, A4H])

  // Dark bg
  cover.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: BG })

  // Purple bar top
  cover.drawRectangle({ x: 0, y: A4H - 6, width: A4W, height: 6, color: ACCENT })

  // Brand name
  const brandName = "SINS 'N LASHES"
  const brandW    = bold.widthOfTextAtSize(brandName, 11)
  cover.drawText(brandName, {
    x: (A4W - brandW) / 2, y: A4H - 90,
    size: 11, font: bold, color: ACCENT,
  })

  // Report title
  const titleLine1 = isSetup ? 'Brand Setup' : 'Weekly Update'
  const titleLine2 = 'Report'
  const t1W = bold.widthOfTextAtSize(titleLine1, 28)
  const t2W = bold.widthOfTextAtSize(titleLine2, 28)
  cover.drawText(titleLine1, { x: (A4W - t1W) / 2, y: A4H - 130, size: 28, font: bold, color: WHITE })
  cover.drawText(titleLine2, { x: (A4W - t2W) / 2, y: A4H - 165, size: 28, font: bold, color: WHITE })

  // Subtitle
  const subtitle = isSetup ? `Erstellt: ${dateStr} - Vollstaendige Basis` : `KW ${kw} - ${dateStr}`
  const subW = regular.widthOfTextAtSize(subtitle, 13)
  cover.drawText(subtitle, { x: (A4W - subW) / 2, y: A4H - 215, size: 13, font: regular, color: MUTED })

  // Divider
  cover.drawRectangle({ x: M + 60, y: A4H - 260, width: CW - 120, height: 1, color: BORDER })

  // Powered by
  const poweredBy = 'Erstellt von KANA.AI Brand Expert Agent'
  const pwW = regular.widthOfTextAtSize(poweredBy, 9)
  cover.drawText(poweredBy, { x: (A4W - pwW) / 2, y: A4H - 278, size: 9, font: regular, color: MUTED })

  // Purple bar bottom
  cover.drawRectangle({ x: 0, y: 0, width: A4W, height: 4, color: ACCENT })

  // ── CONTENT PAGES ───────────────────────────────────────────────
  const sections = parseSections(reportText)
  const headerText = `Sins 'n Lashes - Brand Intelligence Report KW${kw} - ${dateStr}`

  let page    = pdfDoc.addPage([A4W, A4H])
  let pageNum = 2
  let y       = A4H

  const initPage = () => {
    page.drawRectangle({ x: 0, y: 0, width: A4W, height: A4H, color: BG })
    page.drawRectangle({ x: 0, y: A4H - 4, width: A4W, height: 4, color: ACCENT })
    const hw = regular.widthOfTextAtSize(headerText, 7.5)
    page.drawText(headerText, { x: (A4W - hw) / 2, y: A4H - 22, size: 7.5, font: regular, color: MUTED })
    page.drawRectangle({ x: M, y: A4H - 32, width: CW, height: 0.5, color: BORDER })
    y = A4H - 50
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < 50) {
      // Page number
      const pStr = String(pageNum)
      const pW   = regular.widthOfTextAtSize(pStr, 8)
      page.drawText(pStr, { x: (A4W - pW) / 2, y: 28, size: 8, font: regular, color: MUTED })
      pageNum++
      page = pdfDoc.addPage([A4W, A4H])
      initPage()
    }
  }

  initPage()

  const CHARS_PER_LINE = 85 // ~9pt Helvetica in 495pt width

  for (const section of sections) {
    if (!section.header || section.header === 'TITEL') continue

    ensureSpace(40)

    // Section header bg
    const headerH = 26
    page.drawRectangle({ x: M - 8, y: y - headerH + 18, width: CW + 16, height: headerH, color: HEADER_BG })
    page.drawRectangle({ x: M - 8, y: y - headerH + 18, width: 3, height: headerH, color: ACCENT })

    // Clip header text to avoid overflow
    const hdr = section.header.length > 60 ? section.header.slice(0, 60) + '…' : section.header
    page.drawText(hdr, { x: M + 4, y: y, size: 9.5, font: bold, color: ACCENT })
    y -= 32

    const bodyLines = section.body.split('\n').filter(l => l.trim())

    for (const line of bodyLines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('[NEU]')) {
        const rest     = trimmed.slice(5).trim()
        const wrapped  = wrapText(rest, CHARS_PER_LINE - 10)
        ensureSpace(16 + (wrapped.length - 1) * 14)
        // Badge
        page.drawRectangle({ x: M, y: y - 11, width: 28, height: 14, color: GREEN_BG })
        page.drawText('NEU', { x: M + 3, y: y - 8, size: 7, font: bold, color: GREEN })
        // Text
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M + 34, y: y - i * 13, size: 8.5, font: bold, color: GREEN })
        }
        y -= 14 + (wrapped.length - 1) * 13
        continue
      }

      if (trimmed.startsWith('[GEÄNDERT]') || trimmed.startsWith('[GEANDERT]')) {
        const rest    = trimmed.replace(/^\[GEÄ?NDERT\]/, '').trim()
        const wrapped = wrapText(rest, CHARS_PER_LINE - 15)
        ensureSpace(16 + (wrapped.length - 1) * 14)
        page.drawRectangle({ x: M, y: y - 11, width: 54, height: 14, color: ORANGE_BG })
        page.drawText('GEAENDERT', { x: M + 3, y: y - 8, size: 6.5, font: bold, color: ORANGE })
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M + 60, y: y - i * 13, size: 8.5, font: regular, color: ORANGE })
        }
        y -= 14 + (wrapped.length - 1) * 13
        continue
      }

      // Sub-headers
      if (trimmed.match(/^[A-ZÄÖÜ][^:]+:$/) || trimmed.match(/^(TikTok|Instagram|Orphica|Nanolash)(\s|:)/)) {
        const wrapped = wrapText(trimmed, CHARS_PER_LINE)
        ensureSpace(14 * wrapped.length)
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M, y: y - i * 13, size: 8.5, font: bold, color: MED })
        }
        y -= 13 * wrapped.length
        continue
      }

      // Numbered items
      if (trimmed.match(/^[1-9]\./)) {
        const wrapped = wrapText(trimmed, CHARS_PER_LINE - 5)
        ensureSpace(14 * wrapped.length)
        page.drawRectangle({ x: M, y: y - 8, width: 3, height: 3, color: ACCENT })
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M + 8, y: y - i * 13, size: 8.5, font: regular, color: WHITE })
        }
        y -= 13 * wrapped.length
        continue
      }

      // Bullet items
      if (trimmed.match(/^[-•]/)) {
        const content = trimmed.replace(/^[-•]\s*/, '')
        const wrapped = wrapText(content, CHARS_PER_LINE - 6)
        ensureSpace(14 * wrapped.length)
        page.drawCircle({ x: M + 3, y: y - 4, size: 2, color: MUTED })
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M + 10, y: y - i * 13, size: 8.5, font: regular, color: LIGHT })
        }
        y -= 13 * wrapped.length
        continue
      }

      // Arrow items
      if (trimmed.match(/^[↑↓→]/)) {
        const arrow  = trimmed[0]
        const col    = arrow === '↑' ? GREEN : arrow === '↓' ? rgb(0.937, 0.267, 0.267) : MUTED
        const rest   = trimmed.slice(1).trim()
        const wrapped = wrapText(rest, CHARS_PER_LINE - 6)
        ensureSpace(14 * wrapped.length)
        page.drawText(arrow === '↑' ? '^' : arrow === '↓' ? 'v' : '>', { x: M, y, size: 8.5, font: bold, color: col })
        for (let i = 0; i < wrapped.length; i++) {
          page.drawText(wrapped[i], { x: M + 12, y: y - i * 13, size: 8.5, font: regular, color: LIGHT })
        }
        y -= 13 * wrapped.length
        continue
      }

      // Regular text
      const indented = line.match(/^\s{2,}/)
      const wrapped  = wrapText(trimmed, CHARS_PER_LINE)
      ensureSpace(13 * wrapped.length)
      for (let i = 0; i < wrapped.length; i++) {
        page.drawText(wrapped[i], {
          x: indented ? M + 14 : M,
          y: y - i * 12,
          size: indented ? 8 : 8.5,
          font: regular,
          color: indented ? MUTED : LIGHT,
        })
      }
      y -= 12 * wrapped.length
    }

    y -= 14 // Section spacing
  }

  // Final page number
  const fpStr = String(pageNum)
  const fpW   = regular.widthOfTextAtSize(fpStr, 8)
  page.drawText(fpStr, { x: (A4W - fpW) / 2, y: 28, size: 8, font: regular, color: MUTED })

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length':      String(pdfBytes.length),
    },
  })
}
