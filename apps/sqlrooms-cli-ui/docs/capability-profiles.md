# CLI capability profiles

The SQLRooms CLI exposes complete, named production capability profiles. The
profile is selected by the Python launcher, included in `/api/config`, and
resolved once by the UI. Artifact creation, worksheet blocks and renderers,
command registration, run context, instructions, tools, nested agents, and
dashboard map support all consume that same profile.

The checked-in Jest snapshots in
`src/__tests__/__snapshots__/cliCapabilityProfiles.test.ts.snap` are the
deterministic baseline for the exact profile contents. The coherence validator
also checks dependencies between blocks, renderers, commands, artifacts, and AI
tools.

## Current profiles

| Surface                               | `default`             | `experimental`                                                                                    | `worksheet-charts-maps` |
| ------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- | ----------------------- |
| Creatable artifacts                   | worksheet, dashboard  | worksheet, dashboard, pivot, notebook, document, SQL query, HTML app, Python, canvas, app builder | worksheet               |
| Worksheet stateful blocks             | dashboard, data table | dashboard, pivot, data table, map, document, SQL query, HTML app, Python                          | map                     |
| AI-editable worksheet blocks          | chart, dashboard      | chart, dashboard, HTML app, map                                                                   | chart, map              |
| Additional command owners             | none                  | document, Python block, HTML app revision                                                         | none                    |
| Top-level agents                      | dashboard, worksheet  | dashboard, worksheet, HTML app                                                                    | worksheet               |
| Dashboard and embedded-dashboard maps | no                    | yes                                                                                               | no dashboards           |
| Additional instructions               | none                  | experimental app/map/HTML-app routing                                                             | worksheet chart/map     |
| Skills                                | none                  | none                                                                                              | none                    |

All three profiles retain lifecycle state for every currently persisted app slice.
This is intentional: opening a workspace under the narrower `default` profile
must preserve disabled experimental state and show placeholders rather than
deleting or mutating it. The profile controls creation, editing, discovery,
commands, AI exposure, and interactive rendering.

The `worksheet-charts-maps` profile is dashboard-free. It keeps worksheet text,
chart, and direct-map authoring plus data-analysis and artifact-context tools.
Dashboard artifacts, blocks, commands, tools, nested agents, and routing
instructions are not registered. Persisted state remains loaded so opening a
workspace under this narrower profile does not delete disabled content.

## Selection and compatibility

- `--profile default` selects the current normal CLI behavior.
- `--profile experimental` selects the current experimental behavior.
- `--profile worksheet-charts-maps` selects worksheet text/chart/direct-map
  authoring without dashboard capabilities.
- `--experimental` remains a compatibility alias for
  `--profile experimental`.
- `[app].profile` in the SQLRooms TOML config selects a profile when no CLI
  `--profile` is present.
- A CLI `--profile` overrides the config-file value.
- `--experimental` combined with a different selected profile fails with an
  actionable error instead of merging capability flags.
- `experimentalEnabled` remains in runtime config for older bundled UIs;
  `capabilityProfile` is the source of truth for current UIs.

## Model construction baseline

The top-level assistant receives its provider and model from runtime AI
configuration and the current session. Dashboard, worksheet, embedded
dashboard, and HTML-app agents reuse the current session's provider, base URL,
API key, and model through an OpenAI-compatible AI SDK model. Their historical
fallback remains `openai` / `gpt-4.1`; the top-level historical fallback remains
the configured provider's first model or `gpt-4o-mini`.

Profile extraction does not change model construction, maximum steps, transport,
history, persistence, retry, or cancellation behavior.

## Browser and headless fidelity baseline

The production CLI path currently includes the SQLRooms chat transport,
run-context capture, command registry, DuckDB websocket connector, persisted
worksheet/document state, Mosaic chart/dashboard state, Deck map state, and the
profile-selected agents and tools.

The following leaves are browser/UI-specific and will require explicit adapters
or omissions in a future headless eval target:

- React artifact panels and block renderers;
- chart and map canvas/WebGL rendering quality;
- WebContainer runtime and generated-app preview diagnostics;
- Pyodide execution and browser worker lifecycle;
- IndexedDB persistence and optional CRDT websocket synchronization;
- file picker, drag/drop upload, toast, layout, and sidebar interactions.

The behavioral factories and durable stores behind worksheet, chart, dashboard,
map, command, context, and agent behavior are the intended production reuse
boundary. A future headless target must consume these profile modules instead of
copying their lists.
