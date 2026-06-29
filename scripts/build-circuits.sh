#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUITS_DIR="${CIRCUITS_DIR:-"$ROOT_DIR/circuits"}"
BUILD_DIR="${BUILD_DIR:-"$CIRCUITS_DIR/build"}"
CIRCOM_BIN="${CIRCOM:-circom}"
SNARKJS_BIN="${SNARKJS:-"$ROOT_DIR/sdk/node_modules/.bin/snarkjs"}"
PTAU="${PTAU:-}"
PHASE2="${PHASE2:-false}"
CIRCUITS="${CIRCUITS:-register mint transfer deposit withdraw}"
MODULES_DIR="$CIRCUITS_DIR/modules"
DEFAULT_INCLUDE_DIRS="$CIRCUITS_DIR $MODULES_DIR"
EERC_CIRCOMLIB="${EERC_CIRCOMLIB:-"$ROOT_DIR/../../Hackatons/Avalanche/Team1Latam-Hackathon/EncryptedERC/circom/circomlib"}"
if [[ -d "$EERC_CIRCOMLIB" ]]; then
  DEFAULT_INCLUDE_DIRS="$DEFAULT_INCLUDE_DIRS $EERC_CIRCOMLIB"
fi
INCLUDE_DIRS="${INCLUDE_DIRS:-"$DEFAULT_INCLUDE_DIRS"}"

if ! command -v "$CIRCOM_BIN" >/dev/null 2>&1; then
  cargo_candidates=(
    "$HOME/.cargo/bin/circom"
    "$HOME/.cargo/bin/circom.exe"
  )

  if [[ "$ROOT_DIR" =~ ^(/mnt/[a-zA-Z]/Users/[^/]+)/ ]]; then
    cargo_candidates+=("${BASH_REMATCH[1]}/.cargo/bin/circom.exe")
  fi

  for candidate in "${cargo_candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      CIRCOM_BIN="$candidate"
      break
    fi
  done
fi

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

normalize_bash_path() {
  local path="$1"

  if [[ -f "$path" || -d "$path" ]]; then
    printf '%s\n' "$path"
    return 0
  fi

  if [[ -n "$(command -v wslpath || true)" ]]; then
    local converted
    converted="$(wslpath -u "$path" 2>/dev/null || true)"
    if [[ -n "$converted" ]]; then
      printf '%s\n' "$converted"
      return 0
    fi
  fi

  if [[ "$path" =~ ^([A-Za-z]):[\\/](.*)$ ]]; then
    local drive="${BASH_REMATCH[1],,}"
    local rest="${BASH_REMATCH[2]//\\//}"
    printf '/mnt/%s/%s\n' "$drive" "$rest"
    return 0
  fi

  printf '%s\n' "$path"
}

resolve_include() {
  local include_file="$1"
  for include_dir in $INCLUDE_DIRS; do
    if [[ -f "$include_dir/$include_file" ]]; then
      return 0
    fi
  done
  return 1
}

validate_includes() {
  local source="$1"
  local missing=()

  while IFS= read -r line; do
    if [[ "$line" =~ include[[:space:]]+\"([^\"]+)\" ]]; then
      local include_file="${BASH_REMATCH[1]}"
      if ! resolve_include "$include_file"; then
        missing+=("$include_file")
      fi
    fi
  done < "$source"

  if (( ${#missing[@]} > 0 )); then
    echo "Missing includes for $source:" >&2
    for include_file in "${missing[@]}"; do
      echo "  - $include_file" >&2
    done
    echo "Set INCLUDE_DIRS=\"circuits /path/to/helpers\" or add the helper files to circuits/." >&2
    exit 1
  fi
}

compile_circuit() {
  local name="$1"
  local source="$CIRCUITS_DIR/$name.circom"
  local out_dir="$BUILD_DIR/$name"

  if [[ ! -f "$source" ]]; then
    echo "Circuit not found: $source" >&2
    exit 1
  fi

  validate_includes "$source"

  mkdir -p "$out_dir"

  echo "==> Compiling $name"
  local circom_source="$source"
  local circom_out_dir="$out_dir"
  local include_args=()
  for include_dir in $INCLUDE_DIRS; do
    local circom_include_dir="$include_dir"
    if [[ "$CIRCOM_BIN" == *.exe && -n "$(command -v wslpath || true)" ]]; then
      circom_include_dir="$(wslpath -w "$include_dir")"
    fi
    include_args+=("-l" "$circom_include_dir")
  done

  if [[ "$CIRCOM_BIN" == *.exe && -n "$(command -v wslpath || true)" ]]; then
    circom_source="$(wslpath -w "$source")"
    circom_out_dir="$(wslpath -w "$out_dir")"
  fi

  "$CIRCOM_BIN" "$circom_source" \
    --r1cs \
    --wasm \
    --sym \
    --c \
    --output "$circom_out_dir" \
    "${include_args[@]}"

  if [[ "$PHASE2" == "true" ]]; then
    local ptau_path
    ptau_path="$(normalize_bash_path "$PTAU")"
    if [[ -z "$PTAU" || ! -f "$ptau_path" ]]; then
      echo "PHASE2=true requires PTAU=/path/to/powersOfTau.ptau" >&2
      echo "Resolved PTAU path was: $ptau_path" >&2
      exit 1
    fi

    rm -f "$out_dir/$name.zkey" "$out_dir/verification_key.json"

    echo "==> Groth16 setup $name"
    "$SNARKJS_BIN" groth16 setup \
      "$out_dir/$name.r1cs" \
      "$ptau_path" \
      "$out_dir/$name.zkey"

    echo "==> Verifying zkey $name"
    "$SNARKJS_BIN" zkey verify \
      "$out_dir/$name.r1cs" \
      "$ptau_path" \
      "$out_dir/$name.zkey"

    echo "==> Exporting verification key $name"
    "$SNARKJS_BIN" zkey export verificationkey \
      "$out_dir/$name.zkey" \
      "$out_dir/verification_key.json"
  fi
}

require_command "$CIRCOM_BIN"

if [[ "$PHASE2" == "true" ]]; then
  require_command "$SNARKJS_BIN"
fi

mkdir -p "$BUILD_DIR"

for circuit in $CIRCUITS; do
  compile_circuit "$circuit"
done

echo "Circuit build complete: $BUILD_DIR"
