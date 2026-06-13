const APIFY_BASE = 'https://api.apify.com/v2'

function token() {
  const t = process.env.APIFY_API_TOKEN
  if (!t) throw new Error('APIFY_API_TOKEN fehlt in den Environment Variables')
  return t
}

/** Startet einen Apify Actor und wartet bis er fertig ist.
 *  Nutzt waitForFinish=120 damit Apify server-seitig wartet — spart Polling-Runden
 *  und verhindert Railway-Timeout (maxDuration: 300s). */
async function runActor(actorId: string, input: object): Promise<string> {
  // waitForFinish=120: Apify hält die Verbindung bis zu 120s offen und gibt das Ergebnis direkt zurück
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token()}&waitForFinish=120`,
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

  // Wenn der Actor bereits fertig ist (waitForFinish hat geholfen) — direkt zurück
  if (data.status === 'SUCCEEDED') return datasetId
  if (data.status === 'FAILED' || data.status === 'ABORTED') {
    throw new Error(`Apify Actor fehlgeschlagen: ${data.status}`)
  }

  // Fallback-Polling: max. 90 Sekunden (18 × 5s) — Actor läuft noch
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token()}`)
    const { data: runData } = await statusRes.json()
    if (runData.status === 'SUCCEEDED') return datasetId
    if (runData.status === 'FAILED' || runData.status === 'ABORTED') {
      throw new Error(`Apify Actor fehlgeschlagen: ${runData.status}`)
    }
  }
  throw new Error('Apify Actor Timeout (210 Sekunden)')
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
}): Promise<object[]> {
  const adTypeParam = input.adType.toLowerCase() === 'video' ? 'video' : 'image'

  // Actor erwartet Facebook Ad Library URLs
  const urls = input.searchTerms.map(term => ({
    url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=${adTypeParam}&country=${input.country}&q=${encodeURIComponent(term)}&search_type=keyword_unordered`,
  }))

  const datasetId = await runActor('curious_coder~facebook-ads-library-scraper', {
    urls,
    maxResults: input.maxResults,
  })
  return getDatasetItems(datasetId)
}

/** Holt Video-URLs für gegebene Ad-IDs via Meta Ad Scraper */
export async function getVideoUrls(adIds: string[]): Promise<object[]> {
  const datasetId = await runActor('whoareyouanas~meta-ad-scraper', { adIds })
  return getDatasetItems(datasetId)
}
