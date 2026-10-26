# M4 local launcher and distribution verification

> Historical verification: Docker support was retired on 2026-10-27. Current
> enforced isolation is Bubblewrap on Linux/Sprite; macOS requires explicit
> trusted-local execution. See the [current host README](../../apps/roomie-node/README.md).

Scope: the local portion of the M4 launcher/lifecycle item on draft PR #962.
Baseline: `cdbfdbdef94d39ec2435e5d65e01d963855f75d3`. PR #960 remains open at
`eed050a6`; #959 remains open at `8eb7a853`. The base remains
`experiment/quack-node-wasm-v2`. Nothing is merged or published to npm.

## Gaps closed

Previously the host had only its in-process API and `test/live-m2.mjs` acceptance
launcher. The new `bin/roomie-node.mjs` is a foreground launcher for a named
workspace directory, using the existing native host and authentication endpoint.
The build copies the existing Roomie browser output into the host's `dist/ui`.
`pack:local` stages a private npm tarball with bundled SQLRooms code, built UI,
CLI, Docker build files and license notices. Runtime dependencies are pinned to
the installed direct versions; npm resolves transitives during installation.
There are no repository paths or workspace links in the runtime manifest.

No agent is enabled by default. An enabled Codex or Claude requires exactly one
explicit trusted-local or container-isolated mode. Quack is disabled. The host
remains loopback-only; default port zero selects an available port. Browser
opening is optional and receives a single-use URL as one argument without a
shell. Owner credentials are not printed. SIGINT/SIGTERM use the existing drain,
flush and disposal lifecycle. There is no new command, persistence, permission
or agent mechanism.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm exec turbo build --filter=roomie-node
pnpm --filter roomie-node pack:local
pnpm --filter roomie-node test:distribution
```

Install the tarball with npm into a fresh directory, then run its
`node_modules/.bin/roomie-node /path/to/workspace --open`. The package README
contains complete commands and supported Node/platform prerequisites. No Python,
pnpm, Vite development server or repository checkout is required to run it.
First startup may download signed DuckDB extensions. The runtime is not bundled;
Node 24.9–24.x must already be installed.

## Verified locally

macOS arm64, Node 24.22.1, npm installation outside the repository:

- UI and host build/typecheck pass. All **86 native tests pass with zero skips**,
  including the seven existing real container/isolation regressions and five
  launcher regressions. All **65 shared Node/Python conformance tests**, Knip,
  circular-dependency and formatting checks also pass.
- Fresh-tarball installation with lifecycle scripts disabled installs 134 runtime
  packages. All **five installed-launcher tests pass** from an unrelated working
  directory with `NODE_PATH` cleared and no workspace symlinks.
- Invalid flags and incompatible harness mode combinations fail before workspace
  creation. `--help` and `--version` work independently of native initialization.
- Single-use ticket redemption, credential-file permissions and owner-token
  non-disclosure are asserted. Unauthenticated content reads and old page tokens
  after restart are denied. The bundled HTML and its entry assets load.
- Native CSV upload, shared-command document/chart commits and receipt retries
  survive both graceful stop/reopen and SIGKILL/recovery. Duplicate host ownership
  and occupied port failures are explicit; a failed listener startup releases
  its database ownership so a subsequent start succeeds.
- The optional OS opener receives the ticket URL as one argument. This automated
  check substitutes an opener executable; actual rendering is checked separately.
- Both `--harness` selections use production adapters/supervisor and the existing
  credential-free native protocol fixtures. Successful history persists, pending
  owner approvals clear on shutdown, and unfinished work is interrupted/cancelled.
  These are launcher wiring checks, not additional live-model claims.
- The actual browser connected to an npm-installed launcher, rendered a persisted
  document and histogram over uploaded native data, recovered after host restart,
  saved a revision-checked title edit, and showed the saved title/chart after
  reload. The chart contains smoke values 300 and 450; this is not a rerun of the
  full M2 revenue calculation. The original order-grain/refund fixture is unchanged.
- Independent review approved and separately reproduced the fresh-tarball
  installation and launch tests. Direct/transitive dependency pinning is
  documented precisely.

Local logs: `/tmp/roomie-launcher-native.log`,
`/tmp/roomie-launcher-distribution-final.log`, and
`/tmp/roomie-launcher-independent-review.log`. Browser evidence:
`/tmp/roomie-m4-launcher-browser.png` (local verification artifact).

## CI and remaining boundaries

The JavaScript PR workflow now packs and installs the tarball and runs the same
five launch tests on Linux, separately from the complete native suite. Final-head
CI results will be recorded in the plan and PR after they complete.

Windows is unsupported (private credential storage requires tested POSIX
permissions). A tarball can install platform-specific native dependencies on the
target machine; installed `node_modules` must not be copied across platforms.
This draft does not publish a registry release, bundle Node, install an OS service,
automatically migrate legacy files, or enable Quack. Existing Python distribution
is preserved. Sprite leases, the external watchdog and approximately two-hour
deployed acceptance remain unfinished. Container egress and nested Codex shell
limits from the preceding isolation slice remain unchanged.
