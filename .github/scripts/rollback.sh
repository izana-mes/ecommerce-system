#!/usr/bin/env bash
set -euo pipefail

# Expected in env:
# ROLLBACK_CMD="kubectl rollout undo deploy/backend -n prod && kubectl rollout undo deploy/frontend -n prod"

if [ -z "${ROLLBACK_CMD:-}" ]; then
  echo "ROLLBACK_CMD is not set"
  exit 1
fi

echo "Executing rollback command"
sh -c "$ROLLBACK_CMD"
