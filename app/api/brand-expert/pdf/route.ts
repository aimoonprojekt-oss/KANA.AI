import { auth } from '@clerk/nextjs/server'
import { isAdminUser } from '@/lib/platform/supabase'
import PDFDocument from 'pdfkit'

export const runtime = 'nodejs'
export const maxDuration = 30

// Sins 'n Lashes brand colors
const COLOR_BG     = '#0a0a0a'
const COLOR_WHITE  = '#ffffff'
const COLOR_ACCENT = '#9333ea'
const COLOR_MUTED  = '#888888'
const COLOR_BORDER = '#222222'

function getKW(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7)
}

// Parse the report text into sections
function parseSections(text: string): { header: string; body: string }[] {
  const sections: { header: string; body: string }[] = []
  const lines = text.split('\n')
  let current: { header: string; body: string } | null = null

  for (const line of lines) {
    const stripped = line.replace(/[─═╔╗╚╝║]/g, '').trim()
    if (!stripped) continue

    // Section header line (e.g. "─── WEBSITE UPDATE ───")
    if (line.match(/^─{3,}\s+[A-ZÄÖÜ]/)) {
      if (current) sections.push(current)
      current = { header: stripped.replace(/─+/g, '').trim(), body: '' }
      continue
    }

    // Title box lines (╔ ║ ╚)
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
      // Pre-header content
      current = { header: '', body: line }
    }
  }
  if (current) sections.push(current)
  return sections.filter(s => s.body.trim())
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

  const now = reportDate ? new Date(reportDate) : new Date()
  const kw  = getKW(now)
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const isSetup = mode === 'brand-setup'
  const filePrefix = isSetup ? 'Brand_Setup_Report' : 'Brand_Weekly_Update'
  const fileName = `${filePrefix}_${now.toISOString().slice(0, 10)}.pdf`

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size:   'A4',
      margin: 50,
      info: {
        Title:    `Sins 'n Lashes — Brand Intelligence Report KW${kw}`,
        Author:   'KANA.AI Brand Expert',
        Subject:  'Weekly Brand Intelligence Report',
        Creator:  'KANA.AI',
      },
    })

    doc.on('data',  (chunk: Buffer) => chunks.push(chunk))
    doc.on('end',   resolve)
    doc.on('error', reject)

    const pageW = doc.page.width
    const pageH = doc.page.height
    const margin = 50
    const contentW = pageW - margin * 2

    // ── COVER PAGE ────────────────────────────────────────────
    // Dark background rect
    doc.rect(0, 0, pageW, pageH).fill(COLOR_BG)

    // Purple accent bar top
    doc.rect(0, 0, pageW, 6).fill(COLOR_ACCENT)

    // Brand name
    doc.fontSize(11).fillColor(COLOR_ACCENT).font('Helvetica')
       .text('SINS \'N LASHES', margin, 80, { align: 'center', width: contentW, characterSpacing: 4 })

    // Report title
    const titleText = isSetup ? 'Brand Setup\nReport' : 'Weekly Update\nReport'
    doc.fontSize(28).fillColor(COLOR_WHITE).font('Helvetica-Bold')
       .text(titleText, margin, 110, { align: 'center', width: contentW, lineGap: 8 })

    // KW + Date
    const subtitleText = isSetup ? `Erstellt: ${dateStr} — Vollständige Basis` : `KW ${kw} — ${dateStr}`
    doc.fontSize(14).fillColor(COLOR_MUTED).font('Helvetica')
       .text(subtitleText, margin, 210, { align: 'center', width: contentW })

    // Divider
    doc.rect(margin + 60, 250, contentW - 120, 1).fill(COLOR_BORDER)

    // Powered by
    doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica')
       .text('Erstellt von KANA.AI Brand Expert Agent', margin, 265, { align: 'center', width: contentW })

    // ── CONTENT PAGES ─────────────────────────────────────────
    const sections = parseSections(reportText)

    doc.addPage()
    doc.rect(0, 0, pageW, pageH).fill(COLOR_BG)
    doc.rect(0, 0, pageW, 4).fill(COLOR_ACCENT)

    let y = margin
    let pageNum = 2

    const addPageHeader = () => {
      doc.rect(0, 0, pageW, 4).fill(COLOR_ACCENT)
      doc.fontSize(8).fillColor(COLOR_MUTED).font('Helvetica')
         .text(`Sins 'n Lashes — Brand Intelligence Report KW${kw} — ${dateStr}`, margin, 18, {
           align: 'center', width: contentW,
         })
      doc.rect(margin, 30, contentW, 0.5).fill(COLOR_BORDER)
    }

    addPageHeader()
    y = 50

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - 60) {
        // Page number at bottom
        doc.fontSize(8).fillColor(COLOR_MUTED).font('Helvetica')
           .text(String(pageNum), margin, pageH - 35, { align: 'center', width: contentW })
        pageNum++
        doc.addPage()
        doc.rect(0, 0, pageW, pageH).fill(COLOR_BG)
        addPageHeader()
        y = 50
      }
    }

    for (const section of sections) {
      if (!section.header || section.header === 'TITEL') continue

      ensureSpace(40)

      // Section header background
      doc.rect(margin - 8, y - 5, contentW + 16, 26).fill('#111111')
      doc.rect(margin - 8, y - 5, 3, 26).fill(COLOR_ACCENT)

      doc.fontSize(10).fillColor(COLOR_ACCENT).font('Helvetica-Bold')
         .text(section.header, margin + 8, y, { width: contentW - 16 })
      y += 28

      // Section body
      const bodyLines = section.body.split('\n').filter(l => l.trim())
      for (const line of bodyLines) {
        ensureSpace(18)

        const trimmed = line.trim()

        // [NEU] tag — grüner Badge + grüner Text
        if (trimmed.startsWith('[NEU]')) {
          const rest = trimmed.slice(5).trim()
          doc.rect(margin, y, 30, 13).fill('#14532d')
          doc.fontSize(7).fillColor('#22c55e').font('Helvetica-Bold')
             .text('NEU', margin + 3, y + 3, { width: 24 })
          doc.fontSize(9).fillColor('#22c55e').font('Helvetica-Bold')
             .text(rest, margin + 36, y, { width: contentW - 36 })
          y += 16
          continue
        }

        // [GEÄNDERT] tag — oranger Badge + oranger Text
        if (trimmed.startsWith('[GEÄNDERT]') || trimmed.startsWith('[GEANDERT]')) {
          const rest = trimmed.replace(/^\[GEÄNDERT\]|\[GEANDERT\]/, '').trim()
          doc.rect(margin, y, 55, 13).fill('#431407')
          doc.fontSize(7).fillColor('#f97316').font('Helvetica-Bold')
             .text('GEÄNDERT', margin + 3, y + 3, { width: 50 })
          doc.fontSize(9).fillColor('#f97316').font('Helvetica')
             .text(rest, margin + 62, y, { width: contentW - 62 })
          y += 16
          continue
        }

        // Sub-headers
        if (trimmed.match(/^[A-ZÄÖÜ][^:]+:$/) || trimmed.match(/^(TikTok|Instagram|Orphica|Nanolash)(\s|:)/)) {
          doc.fontSize(9).fillColor('#cccccc').font('Helvetica-Bold')
             .text(trimmed, margin, y, { width: contentW })
          y += 14
        }
        // Numbered items
        else if (trimmed.match(/^[1-9]\./)) {
          doc.rect(margin, y + 4, 3, 3).fill(COLOR_ACCENT)
          doc.fontSize(9).fillColor(COLOR_WHITE).font('Helvetica')
             .text(trimmed, margin + 10, y, { width: contentW - 10 })
          y += 14
        }
        // Bullet items
        else if (trimmed.match(/^[-•]/)) {
          doc.circle(margin + 3, y + 5, 2).fill(COLOR_MUTED)
          doc.fontSize(9).fillColor('#dddddd').font('Helvetica')
             .text(trimmed.replace(/^[-•]\s*/, ''), margin + 12, y, { width: contentW - 12 })
          y += 14
        }
        // Arrow items (↑ ↓ →)
        else if (trimmed.match(/^[↑↓→]/)) {
          const arrow = trimmed[0]
          const col = arrow === '↑' ? '#22c55e' : arrow === '↓' ? '#ef4444' : COLOR_MUTED
          doc.fontSize(9).fillColor(col).font('Helvetica-Bold')
             .text(arrow, margin, y, { width: 12 })
          doc.fontSize(9).fillColor('#dddddd').font('Helvetica')
             .text(trimmed.slice(1).trim(), margin + 14, y, { width: contentW - 14 })
          y += 14
        }
        // Indented
        else if (line.match(/^\s{2,}/)) {
          doc.fontSize(8.5).fillColor(COLOR_MUTED).font('Helvetica')
             .text(trimmed, margin + 16, y, { width: contentW - 16 })
          y += 13
        }
        // Regular
        else {
          doc.fontSize(9).fillColor('#dddddd').font('Helvetica')
             .text(trimmed, margin, y, { width: contentW })
          y += 14
        }
      }
      y += 12 // Section spacing
    }

    // Last page number
    doc.fontSize(8).fillColor(COLOR_MUTED).font('Helvetica')
       .text(String(pageNum), margin, pageH - 35, { align: 'center', width: contentW })

    // Purple bar bottom cover page
    doc.rect(0, pageH - 4, pageW, 4).fill(COLOR_ACCENT)

    doc.end()
  })

  const pdfBuffer = Buffer.concat(chunks)

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length':      String(pdfBuffer.length),
    },
  })
}
