#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
BASE="https://sonos.crvsk.me"          # ton endpoint public
TOKEN="${TOKEN:-0f86ddcb900feaa283037e12aa6c77ec11485cba9f724337}"  # ou export TOKEN=... avant
COUNT=50                                # page size pour browse/search
CURL_OPTS=(-sS --connect-timeout 10 --max-time 30)

green(){ printf "\033[32m%s\033[0m\n" "$*"; }
red(){   printf "\033[31m%s\033[0m\n" "$*"; }
info(){  printf "\033[36m%s\033[0m\n" "$*"; }

soap_call(){ # $1=Action $2=Body
  local action="$1" body="$2"
  curl "${CURL_OPTS[@]}" \
    -H "Content-Type: text/xml; charset=utf-8" \
    -H "SOAPAction: \"$action\"" \
    --data-binary "$body" \
    "$BASE/smapi"
}

soap_envelope(){ # $1=inner XML
  cat <<XML
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <credentials xmlns="http://www.sonos.com/Services/1.1">
      <loginToken>$TOKEN</loginToken>
    </credentials>
  </soap:Header>
  <soap:Body>
$1
  </soap:Body>
</soap:Envelope>
XML
}

pass(){ green "✔ $1"; }
fail(){ red "✖ $1"; exit 1; }

# ====== 0) WSDL ======
info "0) Test WSDL: $BASE/wsdl"
if curl "${CURL_OPTS[@]}" -I "$BASE/wsdl" | grep -q "200"; then
  pass "WSDL reachable"
else
  fail "WSDL not reachable"
fi

# ====== 1) getLastUpdate ======
info "1) getLastUpdate"
GLU=$(soap_call "getLastUpdate" "$(soap_envelope '<getLastUpdate xmlns="http://www.sonos.com/Services/1.1"/>' )")
echo "$GLU" | grep -q "<getLastUpdateResponse" && pass "getLastUpdate OK" || fail "getLastUpdate failed"

# ====== 2) Root -> A:artists ======
info "2) getMetadata A:root"
ROOT=$(soap_call "getMetadata" "$(soap_envelope '<getMetadata xmlns="http://www.sonos.com/Services/1.1"><id>A:root</id><index>0</index><count>'$COUNT'</count></getMetadata>' )")
echo "$ROOT" | grep -q ">A:artists<" && pass "Root exposes A:artists" || fail "Root missing A:artists"

# ====== 3) Artists list ======
info "3) getMetadata A:artists"
ARTISTS=$(soap_call "getMetadata" "$(soap_envelope '<getMetadata xmlns="http://www.sonos.com/Services/1.1"><id>A:artists</id><index>0</index><count>'$COUNT'</count></getMetadata>' )")
FIRST_ARTIST_ID=$(echo "$ARTISTS" | sed -n 's/.*<id>A:albums:\([^<]*\)<\/id>.*/\1/p' | head -n1 || true)
[ -n "$FIRST_ARTIST_ID" ] && pass "Artists listed (first=$FIRST_ARTIST_ID)" || fail "No artists returned"

# ====== 4) Albums of artist ======
info "4) getMetadata A:albums:$FIRST_ARTIST_ID"
ALBUMS=$(soap_call "getMetadata" "$(soap_envelope '<getMetadata xmlns="http://www.sonos.com/Services/1.1"><id>A:albums:'"$FIRST_ARTIST_ID"'</id><index>0</index><count>'$COUNT'</count></getMetadata>' )")
FIRST_ALBUM_ID=$(echo "$ALBUMS" | sed -n 's/.*<id>A:tracks:\([^<]*\)<\/id>.*/\1/p' | head -n1 || true)
[ -n "$FIRST_ALBUM_ID" ] && pass "Albums listed (first=$FIRST_ALBUM_ID)" || fail "No albums returned"

# ====== 5) Tracks of album ======
info "5) getMetadata A:tracks:$FIRST_ALBUM_ID"
TRACKS=$(soap_call "getMetadata" "$(soap_envelope '<getMetadata xmlns="http://www.sonos.com/Services/1.1"><id>A:tracks:'"$FIRST_ALBUM_ID"'</id><index>0</index><count>'$COUNT'</count></getMetadata>' )")
FIRST_TRACK_ID=$(echo "$TRACKS" | sed -n 's/.*<id>track:\([^<]*\)<\/id>.*/\1/p' | head -n1 || true)
[ -n "$FIRST_TRACK_ID" ] && pass "Tracks listed (first=$FIRST_TRACK_ID)" || fail "No tracks returned"

# ====== 6) getMediaURI for first track ======
info "6) getMediaURI track:$FIRST_TRACK_ID"
MEDIA_XML=$(soap_call "getMediaURI" "$(soap_envelope '<getMediaURI xmlns="http://www.sonos.com/Services/1.1"><id>track:'"$FIRST_TRACK_ID"'</id></getMediaURI>' )")
MEDIA_URL=$(echo "$MEDIA_XML" | sed -n 's/.*<mediaUrl>\(.*\)<\/mediaUrl>.*/\1/p')
[ -n "$MEDIA_URL" ] && pass "getMediaURI returned URL" || fail "getMediaURI returned empty"

echo "   mediaUrl: $MEDIA_URL"

# ====== 7) Byte-range check on media URL ======
info "7) Byte-Range check (206 Partial Content)"
if curl "${CURL_OPTS[@]}" -I -H "Range: bytes=0-1" "$MEDIA_URL" | grep -q "206"; then
  pass "Stream supports byte-range (OK for Sonos)"
else
  fail "Stream did not return 206 (range) – Sonos playback may fail"
fi

# ====== 8) Search sanity ======
TERM="Beatles"
info "8) search \"$TERM\""
SEARCH=$(soap_call "search" "$(soap_envelope '<search xmlns="http://www.sonos.com/Services/1.1"><term>'"$TERM"'</term><index>0</index><count>9</count></search>' )")
echo "$SEARCH" | grep -q "<searchResponse" && pass "search responded" || fail "search failed"
FOUND=$(echo "$SEARCH" | sed -n 's/.*<total>\([0-9]\+\)<\/total>.*/\1/p')
echo "   total items: ${FOUND:-unknown}"

green "ALL TESTS PASSED ✅"