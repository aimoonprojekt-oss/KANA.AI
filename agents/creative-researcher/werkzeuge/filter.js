#!/usr/bin/env node
// Filtern, Ranken, Auswaehlen.
// Entspricht app/api/research/run/route.ts, Zeilen 16-233. Nicht veraendern,
// ohne dass die Aenderung auch dort passiert.
const fs = require('fs')
const path = require('path')

const SNL_KEYWORDS = ['sinsnlashes', 'sins n lashes', 'sins & lashes', 'sinsnlashes.com']
const RETAILER_KEYWORDS = ['rossmann', 'müller', 'douglas', 'dm ', 'drogerie', 'amazon', 'otto']

function ausschluss(produkt) {
  const p = produkt.toLowerCase()
  if (p.includes('wimpernserum') || p.includes('lash serum') || p.includes('eyelash serum') || p.includes('lash growth'))
    return ['eyelash curler','wimpernzange','lash curler','lash extension','lash glue','lash adhesive','lash kit','lash lift kit','lash perm','false lash','false eyelash','mascara wand','lash applicator','lash tool']
  if (p.includes('augenbrauen') || p.includes('brow serum') || p.includes('eyebrow'))
    return ['brow pencil','brow gel','brow stamp','brow kit','eyebrow pencil','eyebrow stencil']
  if (p.includes('haarserum') || p.includes('hair serum') || p.includes('haaröl') || p.includes('hair oil'))
    return ['hair dye','hair color','hair straightener','hair curler','hair dryer','haarfarbe']
  return []
}

function relevanz(produkt) {
  const p = produkt.toLowerCase()
  if (p.includes('wimpernserum') || p.includes('lash serum') || p.includes('eyelash serum') || p.includes('lash growth'))
    return ['lash','serum','wimper','eyelash','wimpern','wachstum','growth']
  if (p.includes('augenbrauen') || p.includes('brow serum') || p.includes('eyebrow'))
    return ['brow','eyebrow','augenbraue','augenbrauen']
  if (p.includes('haarserum') || p.includes('hair serum') || p.includes('haaröl') || p.includes('hair oil'))
    return ['hair','haar','haarserum','haaröl']
  if (p.includes('rosmarin') || p.includes('rosemary')) return ['rosemary','rosmarin']
  if (p.includes('mascara')) return ['mascara']
  if (p.includes('lifting') || p.includes('lash lift') || p.includes('wimpernlifting'))
    return ['lift','lash lift','wimpernlifting']
  return produkt.toLowerCase().split(/\s+/).filter(w => w.length > 3)
}

function fallback(produkt) {
  const p = produkt.toLowerCase()
  if (p.includes('wimpernserum') || p.includes('lash serum') || p.includes('eyelash serum'))
    return ['lash growth serum','eyelash serum','lash booster']
  if (p.includes('augenbrauen') || p.includes('brow'))
    return ['eyebrow growth serum','brow enhancer','augenbrauenserum']
  if (p.includes('haar') || p.includes('hair') || p.includes('rosmarin') || p.includes('rosemary'))
    return ['hair growth serum','rosemary hair oil','haarwachstum serum']
  if (p.includes('mascara')) return ['lash mascara','lengthening mascara','volumizing mascara']
  if (p.includes('lifting') || p.includes('lash lift')) return ['lash lift kit','lash perm','wimperlifting kit']
  return [produkt]
}

const AUFTRAG = process.env.AUFTRAG_DATEI || '/mnt/session/uploads/auftrag.json'
const auftrag = JSON.parse(fs.readFileSync(AUFTRAG, 'utf8'))

if (process.argv[2] === 'begriffe') {
  console.log(JSON.stringify({
    relevanz:   relevanz(auftrag.targetProduct),
    ausschluss: ausschluss(auftrag.targetProduct),
    fallback:   fallback(auftrag.targetProduct),
  }, null, 2))
  process.exit(0)
}

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null }

const roh = JSON.parse(fs.readFileSync(arg('--ads'), 'utf8'))
const out = arg('--out')
const BEKANNT = process.env.BEKANNTE_DATEI || '/mnt/session/uploads/bekannte-ads.json'
const bekannt = new Set(
  fs.existsSync(BEKANNT) ? JSON.parse(fs.readFileSync(BEKANNT, 'utf8')).map(String) : []
)

const { targetProduct: produkt, adType, adCount, minImpressions = 0, maxVideoDuration = 0 } = auftrag
const relK = relevanz(produkt)
const ausK = ausschluss(produkt)

function pruefe(liste, dauerGrenze) {
  return liste.filter(ad => {
    if (!ad.ad_archive_id) return false
    if (bekannt.has(String(ad.ad_archive_id))) return false
    const text = `${ad.page_name ?? ''} ${ad.link_url ?? ''} ${ad.ad_creative_body ?? ''}`.toLowerCase()
    if (SNL_KEYWORDS.some(k => text.includes(k))) return false
    if (RETAILER_KEYWORDS.some(k => text.includes(k))) return false
    const json = JSON.stringify(ad).toLowerCase()
    if (relK.length > 0 && !relK.some(k => json.includes(k))) return false
    if (ausK.some(k => json.includes(k))) return false
    const imp = parseInt(String(ad.impressions_text ?? '0')) || 0
    if (minImpressions > 0 && imp > 0 && imp < minImpressions) return false
    if (adType === 'VIDEO') {
      const hatVideo = json.includes('.mp4') || json.includes('video_hd_url') || json.includes('video_sd_url')
        || json.includes('"video_url"') || json.includes('"videourl"') || json.includes('"videos"')
        || json.includes('video_preview') || json.includes('"video":{')
      if (!hatVideo) return false
      const rohDauer = ad.video_duration ?? ad.duration ?? ad.video_length ?? ad.videoDuration ?? null
      if (rohDauer !== null && rohDauer !== undefined) {
        const d = Number(rohDauer)
        if (!isNaN(d)) {
          if (d < 5) return false
          if (dauerGrenze > 0 && d > dauerGrenze) return false
        }
      }
    }
    return true
  })
}

let gefiltert = pruefe(roh, maxVideoDuration)
if (maxVideoDuration > 0 && gefiltert.length < adCount) {
  gefiltert = pruefe(roh, maxVideoDuration + 3)   // Toleranz, wie im Altcode
}

const punkte = ad => {
  const tage = ad.start_date ? Math.floor((Date.now() - new Date(String(ad.start_date)).getTime()) / 86400000) : 0
  const imp = parseInt(String(ad.impressions_text ?? '0')) || 0
  const varianten = parseInt(String(ad.ad_count ?? '1')) || 1
  return tage * 10 + imp * 0.0001 + varianten * 5
}

const gewaehlt = gefiltert.sort((a, b) => punkte(b) - punkte(a)).slice(0, adCount)

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ count: gewaehlt.length, ads: gewaehlt }, null, 2))

console.log(JSON.stringify({
  rohtreffer:  roh.length,
  nach_filter: gefiltert.length,
  ausgewaehlt: gewaehlt.length,
  ad_ids:      gewaehlt.map(a => String(a.ad_archive_id)),
  datei:       out,
}))
