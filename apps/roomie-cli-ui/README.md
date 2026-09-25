# Roomie browser application

A fixed, document-focused composition of SQLRooms packages, bundled by the
`roomie` Python distribution. Its only top-level artifact is a Document. Each
document can contain chart, data-table explorer, dashboard and HTML app blocks,
plus ordinary editorial content. Arbitrary custom Mosaic specs are excluded;
rendered charts and tables use physical local data. HTML query requests pass the
host's local-read admission policy before reaching the shared query executor. Dashboard panels are limited to Mosaic charts
and table explorers. Backing state is document-owned and is not exposed as extra
artifacts. No assistant, provider configuration, profiles or CRDT slice is loaded.

Run `pnpm dev roomie [database.duckdb]` from the repository root. It builds shared
packages, installs the paired Python stack, starts API port 4274 and Vite port
3200, waits for readiness, verifies the backend process and binding, and opens a
one-use authorized page link. `--no-open-browser` retains the interactive launch
link without opening a tab. These fixed development ports fail clearly on
conflicts. Use the packaged CLI for an automatically assigned port.

`src/capabilities.ts` is the fixed capability manifest; `src/model.ts` defines
the persisted schema. Commands
in `src/commands.ts` compose the package APIs used by both manual UI actions and
MCP. `src/store.ts` wires only needed slices and validates persisted data before
enabling writes to `__roomie.ui_state`. Table filters are saved as Mosaic-generated
predicates, validated as ordinary local SELECT expressions before agent changes
or hydration. Restored filters appear as a saved baseline; Reset clears them
before choosing a replacement. Column selection, sorting and page size are
editable through Edit blocks → data-table settings.

`pnpm --filter roomie-cli-app test` runs schema, command-boundary and filter
persistence regressions. `pnpm roomie:build` builds the dependency graph, browser
bundle, tool contract, notices, wheel and sdist. See
[Python usage and release instructions](../../python/roomie/README.md) and
[verification evidence](../../python/roomie/VERIFICATION.md).
