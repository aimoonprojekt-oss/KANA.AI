#!/usr/bin/env bash
# Facebook Ad Library ueber Apify durchsuchen.
# Entspricht lib/agents/apify.ts, runActor() + searchFacebookAds() —
# inklusive Polling alle 10 Sekunden, maximal 55 Runden.
# Aufruf: apify-suche.sh "<begriff>" <VIDEO|IMAGE> <max> <ausgabedatei>
set -euo pipefail

BEGRIFF="$1"; FORMAT="$2"; MAX="$3"; OUT="$4"
BASE="https://api.apify.com/v2"
ACTOR="curious_coder~facebook-ads-library-scraper"

AUFTRAG="${AUFTRAG_DATEI:-/workspace/auftrag.json}"
LAND=$(jq -r '.country // "DE"' "$AUFTRAG")
VON=$(jq -r '.startDateMin // empty' "$AUFTRAG")
BIS=$(jq -r '.startDateMax // empty' "$AUFTRAG")

TYP=$(echo "$FORMAT" | tr '[:upper:]' '[:lower:]')
[ "$TYP" = "video" ] || TYP="image"

# Mit Datumsfilter: active_status=all, sonst nur aktive Ads
STATUS="active"; [ -n "$VON$BIS" ] && STATUS="all"

Q=$(jq -rn --arg s "$BEGRIFF" '$s|@uri')
URL="https://www.facebook.com/ads/library/?active_status=${STATUS}&ad_type=${TYP}&country=${LAND}&q=${Q}&search_type=keyword_unordered"
[ -n "$VON" ] && URL="${URL}&start_date[min]=${VON}"
[ -n "$BIS" ] && URL="${URL}&start_date[max]=${BIS}"

# WICHTIG: Token nur im Authorization-Header, NIE als ?token=... in der URL —
# dort wird der Vault-Wert nicht eingesetzt und der Aufruf schlaegt fehl.
START=$(curl -s -X POST "${BASE}/acts/${ACTOR}/runs" \
  -H "Authorization: Bearer $APIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg u "$URL" --argjson c "$MAX" '{urls:[{url:$u}], count:$c}')")

RUN=$(echo "$START"     | jq -r '.data.id')
DATASET=$(echo "$START" | jq -r '.data.defaultDatasetId')
ZUSTAND=$(echo "$START" | jq -r '.data.status')

if [ "$ZUSTAND" != "SUCCEEDED" ]; then
  for _ in $(seq 1 55); do
    sleep 10
    ZUSTAND=$(curl -s --max-time 15 "${BASE}/actor-runs/${RUN}" \
      -H "Authorization: Bearer $APIFY_API_TOKEN" | jq -r '.data.status') || continue
    [ "$ZUSTAND" = "SUCCEEDED" ] && break
    case "$ZUSTAND" in
      FAILED|ABORTED) echo "Apify Actor fehlgeschlagen: $ZUSTAND" >&2; exit 1 ;;
    esac
  done
fi

[ "$ZUSTAND" = "SUCCEEDED" ] || { echo "Apify Actor Timeout — laeuft laenger als 550 Sekunden" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
curl -s "${BASE}/datasets/${DATASET}/items?limit=200" \
  -H "Authorization: Bearer $APIFY_API_TOKEN" > "$OUT"

echo "Rohtreffer: $(jq 'length' "$OUT") -> $OUT"
