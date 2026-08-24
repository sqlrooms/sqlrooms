# CLI capability profiles

The SQLRooms CLI exposes complete, named production capability profiles. The
profile is selected by the Python launcher, included in `/api/config`, and
resolved once by the UI. Artifact creation, document blocks and renderers,
command registration, run context, instructions, tools, nested agents, block
renderer selection, and dashboard map support all consume that same profile.

The checked-in Jest snapshots in
`src/__tests__/__snapshots__/cliCapabilityProfiles.test.ts.snap` are the
deterministic baseline for the exact profile contents. The coherence validator
also checks dependencies between blocks, commands, artifacts, and AI tools.

## Current profiles

| Surface                               | `default`             | `experimental`                                                                                   | `document-charts-maps` |
| ------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ | ---------------------- |
| Creatable artifacts                   | document, dashboard   | document, dashboard, pivot, notebook, Markdown, SQL query, HTML app, Python, canvas, app builder | document               |
| Document stateful blocks              | dashboard, data table | dashboard, pivot, data table, map, Markdown, SQL query, HTML app, Python                         | map                    |
| AI-editable document blocks           | chart, dashboard      | chart, dashboard, HTML app, map                                                                  | chart, map             |
| Additional command owners             | none                  | Markdown, Python block, HTML app revision                                                        | none                   |
| Top-level agents                      | dashboard, document   | dashboard, document, HTML app                                                                    | document               |
| Dashboard and embedded-dashboard maps | no                    | yes                                                                                              | no dashboards          |
| Additional instructions               | none                  | experimental app/map/HTML-app routing                                                            | document chart/map     |
| Skills                                | none                  | none                                                                                             | none                   |

The CLI app retains lifecycle state for every currently persisted app slice,
independently of the selected profile. This app-level invariant is intentional:
opening a workspace under a narrower profile must preserve disabled state and
show placeholders rather than deleting or mutating it. Profiles control
creation, editing, discovery, commands, AI exposure, and interactive rendering;
they do not control store construction or persistence.

`blocks.stateful` is the renderer source of truth. Enabled stateful block types
use their interactive renderer; every other persisted stateful block type uses
the placeholder renderer. Chart rendering remains available as the built-in
non-stateful document surface.

The `document-charts-maps` profile is dashboard-free. It keeps document text,
chart, and direct-map authoring plus data-analysis and artifact-context tools.
Dashboard artifacts, blocks, commands, tools, nested agents, and routing
instructions are not registered. Persisted state remains loaded so opening a
workspace under this narrower profile does not delete disabled content.

## Selection and compatibility

- `--profile default` selects the current normal CLI behavior.
- `--profile experimental` selects the current experimental behavior.
- `--profile document-charts-maps` selects document text/chart/direct-map
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
configuration and the current session. Dashboard, document, embedded
dashboard, and HTML-app agents reuse the current session's provider, base URL,
API key, and model through an OpenAI-compatible AI SDK model. Their historical
fallback remains `openai` / `gpt-4.1`; the top-level historical fallback remains
the configured provider's first model or `gpt-4o-mini`.

Profile extraction does not change model construction, maximum steps, transport,
history, persistence, retry, or cancellation behavior.

## Browser and headless fidelity baseline

The production CLI path currently includes the SQLRooms chat transport,
run-context capture, command registry, DuckDB websocket connector, persisted
Document/Markdown state, Mosaic chart/dashboard state, Deck map state, and the
profile-selected agents and tools.

The following leaves are browser/UI-specific and will require explicit adapters
or omissions in a future headless eval target:

- React artifact panels and block renderers;
- chart and map canvas/WebGL rendering quality;
- WebContainer runtime and generated-app preview diagnostics;
- Pyodide execution and browser worker lifecycle;
- IndexedDB persistence and optional CRDT websocket synchronization;
- file picker, drag/drop upload, toast, layout, and sidebar interactions.

The behavioral factories and durable stores behind document, chart, dashboard,
map, command, context, and agent behavior are the intended production reuse
boundary. A future headless target must consume these profile modules instead of
copying their lists.
