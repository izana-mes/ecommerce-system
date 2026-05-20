#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-security/sbom}"
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
  trivy image --format cyclonedx --output "$OUTPUT_DIR/${safe_name}.cdx.json" "$image"
done
