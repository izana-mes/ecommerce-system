#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

fail=0

check() {
  local pattern="$1"
  local message="$2"
  if rg -n -e "$pattern" app components hooks store lib --glob '!app/api/**' > /tmp/security-gate.out; then
    echo "[FAIL] $message"
    cat /tmp/security-gate.out
    fail=1
  else
    echo "[PASS] $message"
  fi
}

check_literal() {
  local literal="$1"
  local message="$2"
  if rg -n -F "$literal" app components hooks store lib --glob '!app/api/**' > /tmp/security-gate.out; then
    echo "[FAIL] $message"
    cat /tmp/security-gate.out
    fail=1
  else
    echo "[PASS] $message"
  fi
}

check "Authorization\\s*:\\s*['\\\"]Bearer|Bearer\\s+\\$\\{" 'Bearer auth usage in frontend app code'
check_literal 'localStorage.getItem("token"' 'Browser token storage usage'
check_literal "localStorage.setItem(\"token\"" 'Browser token storage usage'
check_literal 'sessionStorage.getItem("token"' 'Browser token storage usage'
check_literal "sessionStorage.setItem(\"token\"" 'Browser token storage usage'
check_literal 'getToken(' 'Legacy getToken helper usage'

if [ "$fail" -ne 0 ]; then
  exit 1
fi
