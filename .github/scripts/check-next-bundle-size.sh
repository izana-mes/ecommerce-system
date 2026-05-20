#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-frontend}"
MAX_MB="${2:-50}"

if [ ! -d "$APP_DIR/.next" ]; then
  echo "Missing $APP_DIR/.next. Run build first." >&2
  exit 1
fi

SIZE_BYTES=$(du -sb "$APP_DIR/.next" | awk '{print $1}')
MAX_BYTES=$((MAX_MB * 1024 * 1024))

echo "Bundle size: $SIZE_BYTES bytes (limit: $MAX_BYTES bytes)"

if [ "$SIZE_BYTES" -gt "$MAX_BYTES" ]; then
  echo "Bundle size check failed for $APP_DIR"
  exit 1
fi

echo "Bundle size check passed for $APP_DIR"
