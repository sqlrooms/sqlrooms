# Threaded Quack investigation — 2026-10-22

## Outcome

**A remote Roomie histogram works with source-built httpfs and Quack extensions,
the unmodified published Wasm runtime, and `maximumThreads: 1`.** The browser uses
the threaded bundle, so Quack can still start its heartbeat thread. One query
thread does not mean the single-thread Wasm bundle.

Verified in Chrome 155 on macOS arm64:

- Browser engine: `v2.0.0-dev88614`, platform `wasm_threads`.
- Remote query: native engine `v2.0.0`, 120 server-owned rows, sum 12960.
- Chart: nine histogram bins, Arrow `Float64` bounds and `Int64` counts, existing
  `createHistogramSpec` / `VgPlotChart` rendering path; visually verified.
- Connection remained queryable after 12 seconds idle with a requested
  `HEARTBEAT_TIMEOUT 6`. This is a short liveness check, not a soak test.
- A minimal page without React, Mosaic, or Roomie also loads both rebuilt
  extensions with one query thread. With two, extension loading can hang (seen
  at httpfs and, on another run, after httpfs while loading Quack).

This is a feasibility workaround, not a production-ready distribution. Rebuilt
extensions are unsigned, metadata compatibility is explicitly relaxed, and only
the localhost client path was tested. Full Roomie integration, TLS/pinning,
cancellation, reconnect, concurrency, and long-running behavior remain untested.

## Root cause of the published httpfs failure

The public `v2.0.0/wasm_threads` httpfs and Quack binaries both import non-shared
`env.memory` (`flags=0`, minima 1 and 2 pages respectively, no maximum). The main
threaded Wasm module supplies shared memory. Logging Emscripten's `dlSetError`
reveals the otherwise hidden error:

```text
LinkError: WebAssembly.Instance(): Import #0 "env" "memory":
mismatch in shared state of memory, declared = 0, imported = 1
```

This matches existing upstream reports:

- [extension-ci-tools #391](https://github.com/duckdb/extension-ci-tools/issues/391)
- [duckdb-wasm #2041](https://github.com/duckdb/duckdb-wasm/issues/2041)
- [duckdb-wasm #1916](https://github.com/duckdb/duckdb-wasm/issues/1916)

The inspected `v2.0-cyanoptera` extension-ci-tools Makefile still omits
`-DUSE_WASM_THREADS=1` from its `wasm_threads` CMake invocation. Its thread flags
also reference `WASM_COMPILE_TIME_EH_FLAGS`, while the defined variable is
`WASM_CXX_EH_FLAGS`. DuckDB's own v2.0.0 Makefile passes the shared-memory option.
This points to the extension producer/build configuration, not Roomie's headers.

A diagnostic import-section patch (shared flag plus maximum 65536 pages) removed
the first rejection but hit a missing TLS initializer. Skipping that initializer
in a temporary debug worker led to an invalid HTTP transport policy and a Quack
function-signature failure. Those modifications are **not** used by the working
configuration; rebuilding is necessary for this experiment.

## Reproduce the working configuration

Run the normal installation and `prepare-vendor.sh` steps from the README. Then,
with Emscripten **6.0.9** activated in the shell, CMake, Ninja, and OpenSSL 3
development files installed:

```sh
# Tested on macOS arm64 with Homebrew OpenSSL 3.
OPENSSL_ROOT_DIR="$(brew --prefix openssl@3)" \
  bash experiments/quack-node-wasm/build-threaded-extensions.sh
POC_THREADS=1 node experiments/quack-node-wasm/server.mjs
```

Open <http://127.0.0.1:4317/?ci-compat=1&threads=1&rebuilt=1>.

The script uses checksum-verified source archives, Emscripten 6.0.9 (matching the
published runtime's workflow), and DuckDB v2.0.0 headers. It sets
`USE_WASM_THREADS=1` and `-fwasm-exceptions`, and builds both loadable extensions.
It writes generated files under `.runtime/threaded-build` and `vendor/rebuilt`.
The npm worker/runtime files are not patched.

The recipe supplies the host OpenSSL development paths required by Quack's
CMake configuration. It has only been tested for the browser's ordinary HTTP
client path; do not infer working native server or OpenSSL certificate-pinning
paths from this Wasm build.

Pinned source identities:

| Source | Commit                                     |
| ------ | ------------------------------------------ |
| DuckDB | `d54cbbe3df17e8e5ce68312f483b4155836112aa` |
| httpfs | `77392a72077a85897db2519fae11e2c0da972b8a` |
| Quack  | `f96420ed46aee9c42064bdb99ddfd1230d6c0086` |

## Minimal upstream reproducer

The included `loader-probe.html` / `loader-probe.mjs` have no Roomie, React, or
Mosaic imports. They instantiate the published threaded runtime and run two
`LOAD` statements, with a 15-second deadline and direct worker termination.

```sh
node experiments/quack-node-wasm/diagnose-loader.mjs
```

With the server running under `POC_THREADS=1`:

| URL path                                          | Observed result                                          |
| ------------------------------------------------- | -------------------------------------------------------- |
| `/loader-probe.html?debug=1`                      | Stock httpfs fails; console exposes the memory LinkError |
| `/loader-probe.html?extensions=rebuilt&threads=1` | Both extensions load                                     |
| `/loader-probe.html?extensions=rebuilt&threads=2` | Extension loading times out                              |

`diagnose-loader.mjs` only adds logging to generated worker copies in
`vendor/debug`. It does not change memory declarations or thread behavior.
Both probe modes explicitly allow unsigned extensions and metadata mismatch to
get beyond the already documented package/release metadata mismatch.

## Upstream follow-up

The shared-memory artifact defect is already reported. Add the v2.0.0 evidence
to #391 / #2041 rather than opening another duplicate for that defect.
Two additional findings merit DuckDB-Wasm investigation:

1. **Empty error details.** `TryInitialLoad` calls `OpenFetchedExtension` on the
   runtime main thread but calls `GetLibraryError()` afterward on the caller.
   Because `dlerror` is thread-local, this appears to lose the original error.
   Capturing the error on the thread that called `dlopen` is the likely fix; it
   has not been rebuilt and verified here.
2. **Loading with more than one query thread hangs.** The minimal page reproduces
   it with correctly rebuilt extensions; one query thread succeeds. Debug logging
   reaches Emscripten's dynamic-library thread synchronization. A plausible cause
   is `main_thread::RunSync` waiting on the calling thread while `dlopen` needs
   that thread to service synchronization. This is a hypothesis, not a confirmed
   code-level fix. Report the reproduction and thread-count difference.

Source references:
[extension producer](https://github.com/duckdb/extension-ci-tools/blob/v2.0-cyanoptera/makefiles/duckdb_extension.Makefile),
[core build target](https://github.com/duckdb/duckdb/blob/v2.0.0/Makefile),
[Wasm loader](https://github.com/duckdb/duckdb-wasm/blob/5beed055bc9fe21eba58207794e0bd271e100ade/lib/src/extension_provider.cc),
[thread dispatch](https://github.com/duckdb/duckdb-wasm/blob/5beed055bc9fe21eba58207794e0bd271e100ade/lib/src/main_thread.cc),
[matching compiler version](https://github.com/duckdb/duckdb-wasm/blob/5beed055bc9fe21eba58207794e0bd271e100ade/.github/workflows/main.yml).

Upstream reports: [v2 artifact reproduction on extension-ci-tools #391](https://github.com/duckdb/extension-ci-tools/issues/391#issuecomment-6360323939) and [DuckDB-Wasm #2288: hidden loader errors and loading hang](https://github.com/duckdb/duckdb-wasm/issues/2288).
