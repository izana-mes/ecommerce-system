#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-security/reports}"
mkdir -p "$OUTPUT_DIR"

images=(
  ecommerce-backend:latest
  ecommerce-frontend:latest
  ecommerce-mcp-server:latest
  ai-chatbot-backend:latest
  ai-chatbot-frontend:latest
)

for image in "${images[@]}"; do
  safe_name="${image//[:\/]/_}"
  trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
    --format table \
    --output "$OUTPUT_DIR/${safe_name}.txt" \
    "$image"

done

