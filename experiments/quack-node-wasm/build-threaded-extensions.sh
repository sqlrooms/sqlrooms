#!/usr/bin/env bash
# Experimental macOS build recipe; produces unsigned, client-tested extensions.
set -euo pipefail
cd "$(dirname "$0")"
fixture="$(pwd)"
build_root="$fixture/.runtime/threaded-build"
: "${OPENSSL_ROOT_DIR:?Set OPENSSL_ROOT_DIR to your OpenSSL 3 development installation}"
if ! emcc --version | head -1 | grep -q '6\.0\.9'; then
  echo 'Activate Emscripten 6.0.9 before running this script.' >&2
  exit 1
fi
mkdir -p "$build_root" "$fixture/vendor/rebuilt"
cd "$build_root"
fetch_source() {
  local name="$1" url="$2"
  if [ ! -f "$name.tar.gz" ]; then
    curl --fail --location "$url" -o "$name.tar.gz"
  fi
}
fetch_source duckdb 'https://github.com/duckdb/duckdb/archive/d54cbbe3df17e8e5ce68312f483b4155836112aa.tar.gz'
fetch_source httpfs 'https://api.github.com/repos/duckdb/duckdb-httpfs/tarball/77392a7207'
fetch_source quack 'https://github.com/duckdb/duckdb-quack/archive/f96420ed46aee9c42064bdb99ddfd1230d6c0086.tar.gz'
shasum -a 256 -c "$fixture/build-source-checksums.txt"
for name in duckdb httpfs quack; do
  mkdir -p "$name"
  tar -xzf "$name.tar.gz" --strip-components=1 -C "$name"
done
cat > extensions.cmake <<CONFIG
duckdb_extension_load(httpfs SOURCE_DIR "$build_root/httpfs")
duckdb_extension_load(quack SOURCE_DIR "$build_root/quack")
CONFIG
emcmake cmake -S duckdb -B build -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_EXTENSIONS_ONLY=1 -DWASM_LOADABLE_EXTENSIONS=1 \
  -DUSE_WASM_THREADS=1 -DDUCKDB_EXPLICIT_PLATFORM=wasm_threads \
  -DDUCKDB_EXPLICIT_VERSION=v2.0.0 \
  -DGIT_COMMIT_HASH=d54cbbe3df17e8e5ce68312f483b4155836112aa \
  -DDUCKDB_EXTENSION_CONFIGS="$build_root/extensions.cmake" \
  -DBUILD_SHELL=OFF -DBUILD_UNITTESTS=OFF -DENABLE_JEMALLOC=OFF \
  -DCMAKE_CXX_FLAGS='-fwasm-exceptions -DWEBDB_FAST_EXCEPTIONS=1 -DDUCKDB_DEBUG_NO_SAFETY -DDUCKDB_FROM_DUCKDB_WASM' \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
  -DOPENSSL_INCLUDE_DIR="$OPENSSL_ROOT_DIR/include" \
  -DOPENSSL_SSL_LIBRARY="$OPENSSL_ROOT_DIR/lib/libssl.a" \
  -DOPENSSL_CRYPTO_LIBRARY="$OPENSSL_ROOT_DIR/lib/libcrypto.a"
cmake --build build --target httpfs_loadable_extension quack_loadable_extension -j 6
for name in httpfs quack; do
  cp "build/extension/$name/$name.duckdb_extension.wasm" "$fixture/vendor/rebuilt/"
done
