# Roomie

Roomie is a local DuckDB workspace for documents containing interactive Mosaic
charts, table explorers, dashboards, and sandboxed HTML apps. AI runs in your
external Claude Code or Codex host through MCP.

This implementation is stacked on SQLRooms #928 (which depends on #927).
Publication is blocked until a SQLRooms release containing the shared runtime and
application adapters is available. The initial release requirement is
`sqlrooms>=0.1.6,<0.2`; the stack is tested with a locally built prerequisite wheel.
Do not publish Roomie against the existing 0.1.5 runtime.

```sh
roomie analysis.duckdb
roomie --no-open-browser analysis.duckdb
python -m roomie --version
roomie agent setup --client claude-code
roomie agent setup --client codex
# Review the preview, then add --apply to install the scoped configuration.
roomie agent status
```

Opening a bare URL does not authorize it. Use the temporary launch link printed
in an interactive terminal, or open_workspace's launchUrl. Page sessions renew
in the same tab; after a server restart, obtain a fresh link. Native credentials
stay in owner-only temporary files and never enter HTML app code.

Use New document and Insert to compose analyses. Add data using Import data or
Upload file. Inspect a table from the sidebar. Edit text directly, configure
charts and dashboards in their settings, and use Edit blocks for HTML source and
advanced table preferences. Table filters persist as a saved baseline; use Reset
to clear that baseline before choosing a replacement. Save status reports actual disk writes. Wait for Saved
before manually closing a tab or stopping the terminal. Managed close waits for
browser flush and database checkpoint. Browser-backed tools require the owning
browser; uncertain mutations are never replayed automatically.

Host setup preserves unrelated MCP entries and rejects conflicts at the `roomie`
key. Claude Code setup returns a `claude --plugin-dir ...` launch command for the
bundled plugin. Codex setup installs a skill under `~/.agents/skills/roomie` and
adds its own MCP entry, using the installed Python interpreter. Re-run setup after
moving/reinstalling the environment. [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and [skills](https://learn.chatgpt.com/docs/build-skills) document these mechanisms.

Roomie's catalog, logs, and managed workspaces live under `ROOMIE_HOME` (default
`~/.roomie`); `ROOMIE_WORKSPACES_DIR` overrides the managed folder. Its database
metadata lives in `__roomie.ui_state` with application `roomie`, schema version 1.
Ordinary DuckDB files and SQLRooms metadata can coexist. Unsupported Roomie
metadata disables startup/saving instead of overwriting it. Full SQLRooms project
conversion is outside this product.

Rendered charts use local physical tables. Arbitrary custom Mosaic specs are
unsupported. HTML queries must be ordinary local reads; import or materialize
external data through the approved database commands before rendering it. Views,
attached databases, dynamic SQL and unverified functions are rejected in rendered
queries.

Roomie initializes no sync or embedded assistant. The SQLRooms dependency still
installs Loro and SQLRooms assets; this is not a CRDT-free dependency tree. Native
credential storage currently supports POSIX platforms; Windows ACLs are unverified.

## Development and release

Build workspace packages before the UI. Use `pnpm dev roomie` for authenticated
API/Vite development, including `--no-open-browser`. `pnpm roomie:build` bundles
assets and creates wheel/sdist; `pnpm roomie:publish:dry` verifies artifacts without
uploading. Recheck the prerequisite release and PyPI name ownership separately.
The dry-run does not upload packages or configure release credentials/Trusted
Publishing.

Development setup requires Node 24, pnpm 11 and uv. End users of the wheel do not
need Node. `pnpm --filter roomie-python dev:setup` installs the paired checkout
runtime and Roomie into `python/.venv`, explicitly bypassing Roomie dependency
resolution only while the upstream release is pending. Published metadata never
uses this development override. Version Roomie independently with
`pnpm cli:version --target roomie --bump patch`; the build synchronizes plugin
and bundled version metadata from `python/roomie/package.json`.

If startup rejects a workspace envelope, keep the file and inspect its metadata;
do not remove unknown fields to force it open. If the external host reports
`waiting_for_browser`, open a fresh launch link for that exact instance. If saving
fails, retain the browser, resolve the database error, then retry Save or managed
close. A failed checkpoint keeps admission stopped and can be retried. A manual
terminal process is never closed by the managed connector.

The initial test platform is macOS arm64, Python 3.12. Python >=3.10 and POSIX are
the declared support range; other Python/OS combinations still need release CI.
The implementation and verification record is [VERIFICATION.md](VERIFICATION.md).
