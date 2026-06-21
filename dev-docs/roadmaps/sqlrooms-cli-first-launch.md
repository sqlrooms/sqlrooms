# sqlrooms-cli First Launch Roadmap

## Goal

Publish `sqlrooms-cli` as a Python tool that can be run with `uvx` or installed
with `uv tool`, giving users a local-first way to create a SQLRooms project,
add data, and build useful dashboards without cloning this monorepo.

The first launch should optimize for a small, reliable path:

```bash
uvx --from sqlrooms-cli sqlrooms ./my-project.duckdb
# or, after installation:
uv tool install sqlrooms-cli
sqlrooms ./my-project.duckdb
```

If we want the shorter `uvx sqlrooms ./my-project.duckdb` command, the PyPI
distribution name needs to be `sqlrooms` or we need a separate package/alias.
The current distribution name is `sqlrooms-cli`, while the console script is
`sqlrooms`.

## Launch Thesis

The CLI should be the fastest way to answer:

> I have local data. Can I turn it into an explorable SQLRooms project and a
> Mosaic dashboard in a few minutes?

For the first public launch, treat Mosaic dashboards as the primary workflow and
notebooks as a secondary, beta workflow. Keep Canvas, app-builder, AI, and remote
database connectors available only if they do not distract from or destabilize
the core local-data dashboard path.

## Current State

Already present in `python/sqlrooms-cli`:

- Python package named `sqlrooms-cli` with a `sqlrooms` console script.
- Bundled static UI support under `sqlrooms/web/static`.
- `pnpm run build:ui` copies the Vite CLI UI into the Python package bundle.
- `SqlroomsHttpServer` starts a DuckDB websocket backend via `sqlrooms-server`
  and serves the bundled UI.
- `--db-path` / positional `DB_PATH` persists project data in a DuckDB file.
- `--meta-db` and `--meta-namespace` support project metadata storage.
- `/api/upload` stores uploaded files beside the project, and the UI loads them
  into DuckDB.
- UI state is persisted into the SQLRooms meta namespace.
- File drop supports CSV, TSV, Parquet, and JSON.
- After file load, the UI creates a Mosaic dashboard artifact and adds a
  profiler panel for the new table.
- The CLI UI includes artifact tabs for dashboards, notebooks, canvas, and apps.
- Optional backend bridges exist for Postgres and Snowflake via extras.
- AI provider settings can be loaded from `~/.config/sqlrooms/config.toml`.

## First Launch Scope

### Include

- Local DuckDB project creation/opening:
  - `sqlrooms ./project.duckdb`
  - `sqlrooms --db-path ./project.duckdb`
  - `sqlrooms :memory:` for throwaway exploration.
- Local data import through the UI:
  - CSV, TSV, Parquet, and JSON drag/drop.
  - Stable table naming from filenames.
  - Clear success/error toasts.
  - Loaded files copied into a predictable project-adjacent
    `sqlrooms_uploads/` directory.
- Mosaic dashboard-first workflow:
  - A dashboard is created automatically when the first table is loaded.
  - A profiler panel is added for each imported table.
  - Users can create dashboards manually from the artifact menu.
  - Users can add basic Mosaic/vgplot panels from the dashboard UI.
  - Dashboard state persists in the DuckDB project.
- Schema exploration:
  - Users can see loaded tables and refresh the schema tree.
  - Internal SQLRooms metadata schemas should remain hidden by default.
- Basic notebook workflow, explicitly marked as beta:
  - Users can create notebook artifacts.
  - SQL cells can query loaded DuckDB tables.
  - Notebook state persists with the project.
- Packaging and installation:
  - Publish wheels and sdists for `sqlrooms-cli`.
  - The wheel must include the built UI bundle.
  - `sqlrooms-server` must be published and installable as a dependency.
  - Clean-environment smoke tests must pass through both `uvx` and
    `uv tool install`.
- Documentation:
  - One quickstart focused on local files -> dashboard.
  - One install section explaining the exact `uvx` command for the chosen PyPI
    package name.
  - One troubleshooting section for ports, missing UI bundle, Python version,
    and browser-open behavior.

### Do Not Emphasize Yet

- App-builder export as a headline feature.
- Canvas as a headline feature.
- AI app generation as a default path.
- Remote database bridges as a default path.
- Multi-user sync.
- Hosted deployment.

These can remain accessible for adventurous users, but the first launch should
not require explaining all of them.

## Missing or Risky Before Launch

### Packaging

- Decide package naming:
  - Option A: keep PyPI distribution `sqlrooms-cli`; document
    `uvx --from sqlrooms-cli sqlrooms`.
  - Option B: publish distribution `sqlrooms`; then `uvx sqlrooms` works.
  - Option C: publish both later, with `sqlrooms` as a thin launcher package.
- Verify the `sqlrooms-cli` and `sqlrooms-server` wheels co-install cleanly into
  the shared `sqlrooms` namespace package.
- Verify clean installs on macOS and Linux at minimum:
  - `uvx --from sqlrooms-cli sqlrooms --help`
  - `uvx --from sqlrooms-cli sqlrooms ./smoke.duckdb --no-open-browser`
  - `uv tool install sqlrooms-cli`
  - `sqlrooms --help`
- Confirm `requires-python` should remain `>=3.10` even though the monorepo
  requires Node `>=22` for development. Users of the published Python tool
  should not need Node.
- Confirm all runtime dependencies are captured transitively. The CLI imports
  `diskcache` via launcher code; today that appears to arrive through
  `sqlrooms-server`, so the smoke test should catch any dependency packaging
  gap.
- Ensure the published wheel always contains `sqlrooms/web/static/index.html`
  and hashed assets.
- Add release automation or a documented manual release checklist so the UI is
  rebuilt before every Python publish.

### CLI UX

- Update help text and README so the product is not described only as the
  "AI example UI". The first sentence should describe a local SQLRooms project
  launcher for adding data and building dashboards.
- Print the opened UI URL and websocket URL clearly on startup.
- Add a startup check that fails loudly when the bundled UI is missing from an
  installed wheel.
- Consider adding a `sqlrooms doctor` command for launch diagnostics:
  - Python version.
  - package versions.
  - static UI bundle present.
  - free HTTP/websocket ports.
  - DuckDB can create/open the selected DB.
- Consider adding a `sqlrooms import` or `sqlrooms add` command after the first
  UI launch if the product promise is specifically "add data to a project" from
  the terminal:

  ```bash
  sqlrooms add ./project.duckdb ./data/*.parquet
  sqlrooms add ./project.duckdb ./sales.csv --table sales
  ```

  This is not required for the dashboard-first launch if drag/drop import is
  good, but it would make the CLI feel more like a real tool than only a server
  launcher.

### Dashboard Workflow

- Smoke-test the exact happy path in a clean project:
  - Start CLI.
  - Drop a CSV.
  - Confirm a table is created.
  - Confirm schema tree refreshes.
  - Confirm a dashboard artifact exists.
  - Confirm a profiler panel renders.
  - Restart CLI on the same DuckDB file.
  - Confirm table and dashboard state return.
- Add at least one tiny fixture dataset for manual QA and docs.
- Decide whether new projects should start with an empty workspace, a default
  dashboard, or a first-run hint. For launch, avoid a heavy onboarding screen;
  the data dropzone and artifact tabs should carry the workflow.
- Verify imported JSON behavior is good enough to advertise. If it is uneven,
  keep launch copy to CSV/TSV/Parquet and list JSON as experimental.
- Verify the dashboard UI exposes enough chart creation controls without AI.
  The first launch should not depend on users configuring an LLM.

### Notebook Workflow

- Treat notebooks as beta for first launch.
- Verify the minimum path:
  - Create notebook.
  - Add SQL cell.
  - Query imported DuckDB table.
  - Restart CLI.
  - Notebook artifact and cell outputs/config return as expected.
- Avoid launch docs that imply notebook parity with Jupyter or Observable.
  Position it as a lightweight SQLRooms-native analysis surface.

### Security and Locality

- Make it explicit that the default CLI binds to `127.0.0.1`.
- Keep `--host 0.0.0.0` documented as advanced, with a warning.
- Continue blocking `/api/project/query` from reading the internal metadata
  namespace.
- Ensure uploads sanitize filenames and cannot escape the upload directory.
- Do not expose API keys in runtime config responses beyond what the local UI
  needs. Revisit this before presenting AI as a first-class public feature.

### Remote Connectors

- Keep Postgres and Snowflake as optional extras:

  ```bash
  uv tool install "sqlrooms-cli[postgres]"
  uv tool install "sqlrooms-cli[snowflake]"
  uv tool install "sqlrooms-cli[connectors]"
  ```

- Do not include connector setup in the main quickstart.
- Add a separate advanced page once the local-data quickstart is solid.
- Verify connector settings can be edited/saved safely through
  `~/.config/sqlrooms/config.toml`.

## Launch Acceptance Criteria

- A user with Python and `uv` installed can run the documented command without
  cloning the repo or installing Node.
- The command opens a browser to the CLI UI.
- A small CSV can be dropped into a new DuckDB project.
- The imported table appears in the schema explorer.
- A Mosaic dashboard/profiler appears automatically.
- Restarting the CLI with the same DuckDB file restores the user state.
- `uv tool install` exposes the `sqlrooms` command globally.
- The package README matches the exact installation command.
- The release checklist includes UI build, tests, wheel inspection, and clean
  `uvx` smoke tests.

## Suggested Milestones

### Milestone 0: Decide the Product Shape

- Confirm first-launch positioning: "local data to Mosaic dashboard".
- Decide whether the package name remains `sqlrooms-cli` or becomes
  `sqlrooms`.
- Decide whether notebooks are visible by default or beta/secondary.
- Decide whether Canvas and App artifacts should stay visible in the first
  public UI.

### Milestone 1: Packaging Hardening

- Rebuild and bundle the CLI UI.
- Build `sqlrooms-server` and `sqlrooms-cli`.
- Inspect wheel contents for static assets.
- Test clean `uvx` execution.
- Test clean `uv tool install`.
- Fix README/help text around install commands and launch behavior.

### Milestone 2: Dashboard Happy Path

- Add or document a fixture dataset.
- Run the full local-file import -> dashboard -> restart smoke test.
- Fix any dashboard persistence, schema refresh, or profiler rendering issues.
- Make startup logs and error messages launch-quality.

### Milestone 3: Notebook Beta

- Verify notebook SQL cell workflow against imported data.
- Add a short beta note to docs.
- Fix only blocking notebook persistence/query issues.

### Milestone 4: Public Release

- Publish `sqlrooms-server`.
- Publish `sqlrooms-cli`.
- Test the exact public install commands after publish.
- Tag the release.
- Announce with a single dashboard-first quickstart.

## Open Questions

- Should the PyPI distribution be `sqlrooms`, `sqlrooms-cli`, or both?
- Should the first visible UI artifact set be only Dashboard + Notebook, or keep
  Dashboard + Notebook + Canvas + App?
- Is terminal-driven data import (`sqlrooms add`) important for first launch, or
  is drag/drop enough?
- Should remote connectors be hidden unless configured, or visible as an
  advanced section in the left sidebar?
- What is the smallest demo dataset that best shows off Mosaic dashboards?
