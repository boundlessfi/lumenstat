#!/usr/bin/env bash
# Checks the web collect endpoint's SCF rules from the command line.
# Usage: scripts/smoke-web.sh <website id> [umami url]
set -euo pipefail

website="${1:?usage: scripts/smoke-web.sh <website id> [umami url]}"
umami="${2:-http://localhost:3000}"
ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

send() {
  local label="$1"; shift
  local body
  body=$(printf '{"type":"event","payload":{"website":"%s","hostname":"localhost","url":"/smoke?utm_source=smoke&token=secret","screen":"1440x900","language":"en-US"}}' "$website")
  local reply
  reply=$(curl -s -X POST "$umami/api/send" -H "content-type: application/json" -H "user-agent: ${AGENT:-$ua}" "$@" -d "$body")
  if printf '%s' "$reply" | grep -q '"cache"'; then echo "counted   $label"; else echo "rejected  $label  ($reply)"; fi
}

send "browser fetch from the site's domain" -H 'origin: http://localhost:8088' -H 'sec-fetch-mode: cors' -H 'sec-fetch-site: same-site'
send "no Origin header (server-side post)"
send "Origin but no Fetch Metadata" -H 'origin: http://localhost:8088'
send "browser fetch from another domain" -H 'origin: https://evil.example' -H 'sec-fetch-mode: cors' -H 'sec-fetch-site: cross-site'
AGENT='curl/8.7.1' send "bot user agent" -H 'origin: http://localhost:8088' -H 'sec-fetch-mode: cors' -H 'sec-fetch-site: same-site'
