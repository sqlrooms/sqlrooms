#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor/wasm vendor/extensions/wasm_threads
if [ ! -f vendor/wasm/duckdb-wasm-packages.zip ]; then
  gh run download 39574076930 --repo duckdb/duckdb-wasm \
    --name duckdb-wasm-packages-loadable --dir vendor/wasm
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
unzip -qo vendor/wasm/duckdb-wasm-packages.zip \
  'packages/duckdb-wasm/dist/*' 'packages/duckdb-wasm/package.json' -d vendor/wasm
