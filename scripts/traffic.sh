#!/usr/bin/env bash
# Sends a mix of requests to the example test API so the API analytics path has data.
# Usage: scripts/traffic.sh [rounds]
set -euo pipefail

rounds="${1:-20}"
api="${TEST_API_URL:-http://localhost:3100}"
raw="${TEST_RAW_API_URL:-http://localhost:3101}"

# Randomly generated, checksum-valid testnet-style addresses (no funds, no owners).
accounts=(
  GA5YQHLXHOEFNQA563Z3FOOMCXQJOVLLT62O2UOSJLLZI27YJEZKCWOL
  GBSBJAIM7DYYBDDIIUVGW635NPZBCDUSIYLWZ75PHYSSB4KAJSGAJH72
  GDZAZPVFOQ2WHQJ3FTP3J3MNQ2OP2SXC37UUE2C5OI44Z4NJOKN42N72
)
contract=CAILG6I6GWOAS3PGCFRGFYMA2BAWHT7GVBFT2FT4OLJMHQXGOJJ326R2
muxed=MCF4USQD4ND2G4SRDBXOPLBUXRBOAY4ULZ75JV5UI3XNQOMPMOAAOLFM2KUZ6RQFS7KZM

hit() { curl -s -o /dev/null -w '%{http_code} ' "$@" || true; }

for i in $(seq 1 "$rounds"); do
  for a in "${accounts[@]}"; do hit "$api/accounts/$a"; done
  hit "$api/tx/$(openssl rand -hex 32)"
  hit -X POST "$api/bounties/$((RANDOM % 900 + 100))/submissions"
  hit "$api/health"
  if (( i % 5 == 0 )); then hit "$api/slow"; fi
  if (( i % 4 == 0 )); then hit "$api/boom"; fi
  # No router on this port: only the raw path reaches the collector.
  hit "$raw/legacy/accounts/${accounts[$((i % 3))]}/balance"
  hit "$raw/legacy/contracts/$contract/events?page=$i"
  hit "$raw/legacy/pay/$muxed"
  hit "$raw/legacy/orders/$((RANDOM))"
done
echo
echo "Sent $rounds rounds. Spans are flushed every 1 s by the SDK and every 15 s by spanmetrics."
