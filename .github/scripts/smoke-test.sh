#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?BASE_URL is required}"

check() {
  local name="$1"
  local url="$2"
  echo "Smoke check: $name -> $url"
  code=$(curl -sk -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" -lt 200 ] || [ "$code" -ge 400 ]; then
    echo "Smoke check failed for $name with status $code"
    exit 1
  fi
}

check "frontend" "$BASE_URL/"
check "backend-health" "$BASE_URL/api/health"
