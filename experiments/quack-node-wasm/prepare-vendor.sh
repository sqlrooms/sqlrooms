#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor/npm vendor/extensions/wasm_threads
archive="vendor/npm/duckdb-wasm-1.33.1-dev110.0.tgz"
if [ ! -f "$archive" ]; then
  curl --fail --location \
    'https://registry.npmjs.org/@duckdb/duckdb-wasm/-/duckdb-wasm-1.33.1-dev110.0.tgz' \
    -o "$archive"
fi
for platform in wasm_eh wasm_threads; do
  for extension in quack httpfs; do
    target="vendor/extensions/$extension.duckdb_extension.wasm"
    if [ "$platform" = wasm_threads ]; then
      target="vendor/extensions/wasm_threads/$extension.duckdb_extension.wasm"
    fi
    if [ ! -f "$target" ]; then
      curl --fail --location "https://extensions.duckdb.org/v2.0.0/$platform/$extension.duckdb_extension.wasm" -o "$target"
    fi
  done
done
shasum -a 256 -c vendor-checksums.txt
tar -xzf "$archive" -C vendor/npm
