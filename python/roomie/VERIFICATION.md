# Roomie implementation verification

Verified September 21, 2026 on macOS arm64, Python 3.12.9, Node 24.19.0 and
pnpm 11.1.2. This change is stacked on SQLRooms #928 at
`fdc9aec9fbe6e48736c1ab3958a0e728945c3b25`, which depends on #927.

## Implemented contract

Roomie owns its launcher, document composition, capability manifest, host setup,
`ROOMIE_HOME` catalog and `__roomie.ui_state` envelope. Shared SQLRooms code owns
DuckDB, ASGI, authentication, uploads, MCP transport and managed lifecycle. The
SQLRooms application retains its existing defaults. Neither application adopts
the other's registered instances. Roomie exposes only document artifacts and
chart, table explorer, dashboard and sandboxed HTML app analytical blocks.

The manifest in `apps/roomie-cli-ui/src/capabilities.ts` drives insertion and
validation; the build emits the matching packaged manifest and host guidance.
The MCP contract comes from the same shared local capabilities as the browser.
Late registration of generic layout commands cannot broaden Roomie's MCP surface.
Arbitrary custom Mosaic specs are excluded. Rendered charts/tables require physical
local tables; HTML queries use a host policy that rejects external readers, views,
attached databases and unverified functions. Use approved imports/materialization
for such sources. Source selectors apply the same restriction while the separate
schema catalog can retain metadata for inspection.

## Automated checks

| Check                                                                            | Result                                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `python/.venv/bin/python -m pytest python/sqlrooms/tests python/roomie/tests -q` | 304 passed                                                            |
| Roomie UI Jest                                                                   | 43 passed, 5 suites                                                   |
| SQLRooms CLI UI Jest                                                             | 220 passed, 40 suites; includes 49 focused shared-adapter regressions |
| DuckDB metadata/filter regressions                                               | 39 passed                                                             |
| HTML app runtime Jest                                                            | 31 passed                                                             |
| `@sqlrooms/mcp` Jest                                                             | 14 passed                                                             |
| Mosaic dashboard, runtime issue and chart runtime Jest                           | 25 passed                                                             |
| CLI argument/readiness, WebSocket proxy and external-host supervisor Node tests  | 24 passed                                                             |
| Roomie dependency graph and TypeScript/browser build                             | 23 build tasks passed                                                 |
| Lint for changed shared packages and their dependencies                          | 22 tasks passed (existing warnings)                                   |
| Ruff on Roomie and the changed shared agent/bootstrap modules                    | Passed                                                                |
| `pnpm roomie:publish:dry`                                                        | Passed; no upload                                                     |
| `uvx twine check` on wheel and sdist                                             | Passed                                                                |
| `pnpm test --concurrency=1`                                                      | 35 tasks passed (26 reused successful results)                        |
| `pnpm knip` and circular dependency check (including Roomie)                     | Passed                                                                |

The Python checks cover separate catalogs/registries, application identity,
removed flags, page/native credential purposes, Host/Origin checks, one-use
tickets, invalid tokens, profile-free contracts, foreign metadata preservation,
disabled sync storage/messages, host configuration conflicts, failed browser
flush and retryable checkpoint failure. Shared tests cover cancellation and
uncertain-result behavior. TypeScript checks cover supported schemas, block
ownership, unsafe persisted filters, filter restoration, delayed selection
events, command admission, approval and persistence.

The Mosaic regression reproduced live chart handles being frozen by an unrelated
Immer update. A non-draftable runtime cache preserves mutable chart lifecycle
state while ordinary configuration remains frozen. Tests cover later updates,
cache replacement and eviction.

## Embedded-browser and host checks

The Codex embedded browser was used against the packaged application and the
authenticated Vite development app. The verification data was a disposable CSV:

```csv
region,revenue
North,120
South,85
North,160
West,95
South,140
```

- Created and edited documents through visible controls, imported/materialized
  data, and rendered a real Mosaic chart.
- Codex CLI **0.145.0** connected over stdio MCP, discovered commands, imported the
  CSV after the owning browser's **Allow once** approval, created all four block
  families, revised them and read them back. A follow-up host run selected the
  dashboard dataset and used the documented `window.sqlrooms.query` HTML bridge.
- Verified chart counts, the table's North filter and ascending revenue sort,
  dashboard chart/table panels, and the sandboxed HTML app displaying **600**
  across **5 sales records**. Resized the dashboard panel after the retention fix.
- Verified a sandboxed HTML revision attempting `read_csv_auto` is rejected by
  the live host policy; undid that revision and verified the local-data report
  still renders.
- Reloaded the browser, restarted the process, performed a managed close with
  successful browser flush, inspected the closed DuckDB file, then reopened it
  using a fresh ticket. The same four blocks, table preferences, dashboard layout,
  HTML files/revisions and renamed HTML title remained present. The page reported
  **Saved** and **External AI · ready**.
- Ran two Roomie workspaces alongside SQLRooms. Cross-product instance targeting
  returned `stale_target`; opening a database already owned by another writer
  returned `database_open_failed`; the original Roomie instance stayed verified.
- `pnpm dev roomie ... --no-open-browser` started API/Vite, verified the intended
  process and binding, and issued the temporary page ticket. A bare Vite URL
  showed the authorization requirement; the authorized page survived reload.
- Claude Code **2.1.205** passed strict bundled-plugin validation and connected
  with all 11 MCP tools and the Roomie skill loaded. Its model response did not
  complete during this session, so **Claude authoring remains unverified**.
  Host checks used temporary configuration; personal host settings were not changed.

## Distribution and footprint

Built wheel and sdist, copied the sdist outside the checkout, rebuilt its wheel,
and installed it into a fresh environment with a separately built prerequisite
SQLRooms wheel. The installed console entry point served its bundled assets and
rejected unauthenticated configuration access with Node absent from `PATH`.
Runtime imports resolved to the fresh environment's SQLRooms distribution.
SIGTERM released the database so it could be reopened. The sync-disabled
ASGI lifespan was also exercised without importing `sqlrooms.server.sync`,
`sqlrooms.crdt` or `loro`.

The local prerequisite wheel retains the stack's current **0.1.5** metadata. It
contains these unreleased shared adapters; it is **not the published 0.1.5 wheel**.
Roomie's local paired installation deliberately uses `--no-deps` after installing
that prerequisite. This verifies the stack, not public dependency resolution.

Measured production output (minifier/compression changes can alter these sizes):

| Artifact                                                          |                      Size |
| ----------------------------------------------------------------- | ------------------------: |
| Roomie wheel                                                      |           1,240,662 bytes |
| Roomie sdist                                                      |           1,567,645 bytes |
| Bundled static files                                              | 22 files; 5,586,994 bytes |
| JavaScript, total gzip                                            |           1,151,481 bytes |
| Paired SQLRooms wheel                                             |           7,260,613 bytes |
| Fresh environment `site-packages`, both products and dependencies |     approximately 323 MiB |

The wheel includes HTML/JS/CSS, fixed capability and tool manifests, host guidance,
plugin metadata, version metadata, MIT notice and dependency notices. It owns no
`sqlrooms/*` files. The SQLRooms dependency still installs Loro and SQLRooms UI
assets. Roomie has no CRDT initialization; the installation is not CRDT-free.

## Remaining release gates and broader-build limits

- Published metadata requires `sqlrooms>=0.1.6,<0.2`. PyPI had only 0.1.5 during
  verification; the compatible upstream release must ship first. The upload path
  checks prerequisite availability. A release owner must also verify its APIs
  and run normal dependency resolution against that release.
- The PyPI `roomie` endpoint returned 404. This does not establish the intended
  account's right to publish the name. Ownership and release credentials/Trusted
  Publishing must be verified separately. No package was uploaded.
- Python >=3.10/POSIX is declared; only Python 3.12/macOS arm64 was exercised here.
  Other supported combinations need release CI. Windows ACL support is not claimed.
- Full repository `pnpm build` and `pnpm typecheck` stop at a MapLibre `LayerSpecification` type
  mismatch in the unmodified `packages/deck/src/protomapsStyles.ts`. Full SQLRooms
  app typechecking also reports missing workspace declarations after that graph
  stops. Its direct Vite production build and all 220 Jest tests passed. Roomie's
  complete dependency graph and typecheck passed. The root typecheck completed
  54 tasks before the Deck failure. The pre-push hook therefore cannot complete;
  its remaining checks were run separately. The initial highly parallel test run
  hit timeouts; rerunning with `--concurrency=1` passed all 35 test tasks after
  fixing an authorization test fixture to refresh its expiry for each test.

Stages 1–3 and the development/artifact work in stage 4 are implemented and
verified within the limits above. Public installation/release readiness remains
gated on the upstream release, publishing ownership and the broader platform matrix.
