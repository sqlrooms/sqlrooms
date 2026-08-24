# CLI in-process eval target

The target runs the production `document-charts-maps` profile in Node. It
reuses the CLI profile resolver, command and tool composition, AI slice, local
chat transport, run-context code, document agent, block-document commands,
document/deck state, and `@sqlrooms/duckdb-node`.

The target-specific layer only provides an in-memory fixture, an injected AI
SDK model, lifecycle control, durable-state snapshots, and conversion to the
shared `@sqlrooms/evals` evidence envelope. Mock runs require neither browser
globals nor network access.

## Fidelity matrix

| Surface                            | Mode    | Notes                                                       |
| ---------------------------------- | ------- | ----------------------------------------------------------- |
| Capability profile                 | Reused  | Resolved by the production profile resolver                 |
| AI slice and chat transport        | Reused  | Executes the local production transport in process          |
| Top-level and document tools       | Reused  | Composed by the same profile-driven factory                 |
| Nested document agent              | Reused  | Model is injected through the agent's production model seam |
| Run context                        | Reused  | Uses the production resolver and formatter                  |
| Commands                           | Reused  | Registers the same profile-selected command factories       |
| DuckDB                             | Adapted | Node connector replaces the browser/server connector        |
| Document/chart/map state           | Reused  | Real artifact, document, chart-block, and deck-map state    |
| Persistence and CRDT               | Omitted | Each target is intentionally isolated and ephemeral         |
| React renderers and browser layout | Omitted | Structural state is graded before rendering quality         |
| Standalone chat chart/image tools  | Omitted | UI-only leaves; document chart tools remain real            |
| WebContainer, Python, dashboards   | Omitted | Disabled by `document-charts-maps`                          |

Always call `dispose()` in `finally`; it cancels AI runtime resources, removes
registered commands, waits for schema refresh, and closes native DuckDB.
