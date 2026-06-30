#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINDINGS_DIR="${BINDINGS_DIR:-$ROOT/sdk/bindings}"
RELEASE_DIR="$ROOT/target/wasm32v1-none/release"
STELLAR_BIN="${STELLAR_BIN:-stellar}"
USE_POWERSHELL_STELLAR=0

if ! command -v "$STELLAR_BIN" >/dev/null 2>&1; then
  USE_POWERSHELL_STELLAR=1
fi

windows_path() {
  if command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$1"
  else
    printf '%s' "$1"
  fi
}

stellar_bindings() {
  local wasm="$1"
  local output="$2"

  if [[ "$USE_POWERSHELL_STELLAR" == "1" ]]; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \
      "& 'C:\Program Files (x86)\Stellar CLI\stellar.exe' contract bindings typescript --wasm '$(windows_path "$wasm")' --output-dir '$(windows_path "$output")' --overwrite"
  else
    "$STELLAR_BIN" contract bindings typescript \
      --wasm "$wasm" \
      --output-dir "$output" \
      --overwrite
  fi
}

patch_field_bytes_alias() {
  local index_ts="$1/src/index.ts"

  INDEX_TS="$index_ts" node <<'JS'
const fs = require("node:fs");
const indexPath = process.env.INDEX_TS;
const alias = "export type FieldBytes = Buffer;\n";
let text = fs.readFileSync(indexPath, "utf8");

if (text.includes("FieldBytes") && !text.includes(alias)) {
  text = text.replace(
    /if \(typeof window !== "undefined"\) \{\r?\n/,
    `${alias}\nif (typeof window !== "undefined") {\n`,
  );
  fs.writeFileSync(indexPath, text);
}
JS
}

generate_binding() {
  local name="$1"
  local wasm="$RELEASE_DIR/$name.optimized.wasm"
  local output="$BINDINGS_DIR/$name"

  if [[ ! -f "$wasm" ]]; then
    echo "Missing optimized WASM: $wasm" >&2
    echo "Run: make build-contracts" >&2
    exit 1
  fi

  stellar_bindings "$wasm" "$output"
  patch_field_bytes_alias "$output"

  (
    cd "$output"
    npm install --strict-ssl=false
    npm run build
  )
}

generate_binding "encrypted_token"
generate_binding "groth16_verifier"
