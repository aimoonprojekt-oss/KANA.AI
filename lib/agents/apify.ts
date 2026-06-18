const APIFY_BASE = 'https://api.apify.com/v2'

function token() {
  const t = process.env.APIFY_API_TOKEN
  if (!t) throw new Error('APIFY_API_TOKEN fehlt in den Environment Variables')
  return t
}

/** Startet einen Apify Actor async und pollt bis er fertig ist.
 *  Polling: alle 10s, max. 55 Versuche = 550s — passt in Railway's 600s maxDuration.
 *  Damit können auch große Jobs (viele Ads, lange Laufzeit) sicher abgeschlossen werden. */
async function runActor(actorId: string, input: object): Promise<string> {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!res.ok) throw new Error(`Apify Actor Start fehlgeschlagen: ${res.status}`)
  const { data } = await res.json()
  const runId: string = data.id
  const datasetId: string = data.defaultDatasetId

  if (data.status === 'SUCCEEDED') return datasetId
  if (data.status === 'FAILED' || data.status === 'ABORTED') {
    throw new Error(`Apify Actor fehlgeschlagen: ${data.status}`)
  }

  // Polling alle 10s — max. 55 × 10s = 550s (innerhalb Railway's 600s Limit)
  for (let i = 0; i < 55; i++) {
    await new Promise(r => setTimeout(r, 10000))
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15s Timeout pro Poll
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token()}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!statusRes.ok) continue // Bei HTTP-Fehler: nächste Runde versuchen
      const { data: runData } = await statusRes.json()
      if (runData.status === 'SUCCEEDED') return datasetId
      if (runData.status === 'FAILED' || runData.status === 'ABORTED') {
        throw new Error(`Apify Actor fehlgeschlagen: ${runData.status}`)
      }
    } catch (err) {
      // Bei FAILED/ABORTED Error weiterwerfen, bei Netzwerkfehler weiterpollen
      if (err instanceof Error && err.message.startsWith('Apify Actor fehlgeschlagen')) throw err
      // Netzwerkfehler / Timeout → nächste Polling-Runde
    }
  }
  throw new Error('Apify Actor Timeout — läuft länger als 550 Sekunden')
}

/** Holt alle Items aus einem Apify Dataset */
async function getDatasetItems(datasetId: string): Promise<object[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token()}&limit=200`
  )
  if (!res.ok) throw new Error(`Dataset abrufen fehlgeschlagen: ${res.status}`)
  return res.json()
}

/** Durchsucht die Facebook Ad Library */
export async function searchFacebookAds(input: {
  searchTerms: string[]
  adType: string
  country: string
  maxResults: number
  startDateMin?: string  // YYYY-MM-DD
  startDateMax?: string  // YYYY-MM-DD
}): Promise<object[]> {
  const adTypeParam = input.adType.toLowerCase() === 'video' ? 'video' : 'image'

  // Mit Datumsfilter: active_status=all + Datum-Parameter, sonst nur aktive Ads
  const hasDateFilter = input.startDateMin || input.startDateMax
  const activeStatus = hasDateFilter ? 'all' : 'active'

  let urlStr = `https://www.facebook.com/ads/library/?active_status=${activeStatus}&ad_type=${adTypeParam}&country=${input.country}&q=${encodeURIComponent(input.searchTerms[0])}&search_type=keyword_unordered`
  if (input.startDateMin) urlStr += `&start_date[min]=${input.startDateMin}`
  if (input.startDateMax) urlStr += `&start_date[max]=${input.startDateMax}`

  const urls = [{ url: urlStr }]

  const datasetId = await runActor('curious_coder~facebook-ads-library-scraper', {
    urls,
    count: input.maxResults,
  })
  return getDatasetItems(datasetId)
}

/** Holt Video-URLs für gegebene Ad-IDs via Meta Ad Scraper */
export async function getVideoUrls(adIds: string[]): Promise<object[]> {
  const datasetId = await runActor('whoareyouanas~meta-ad-scraper', { adIds })
  return getDatasetItems(datasetId)
}
