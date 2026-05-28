# Shared Session Backend Plan

## Goal

Make `sqlrooms-server` and the CLI-backed app suitable for a single shared
collaborative session where multiple users connect to the same room through one
server process.

The intended deployment model is "one runtime per session", for example a
session backend launched on demand by sprites.dev or a similar platform. The
server process should be bound to one configured session identity, one CRDT room,
one DuckDB database, and one metadata store.

## Non-Goals

- Do not build a multi-tenant server that hosts many rooms in one long-lived
  process.
- Do not add full organization/user/team management.
- Do not require per-user roles in the first implementation. A single
  read-write session capability is acceptable for the first shared-session
  backend.
- Do not replace DuckDB with a managed database layer.
- Do not make browser-only or local CLI workflows depend on the shared-session
  backend.
- Do not solve untrusted code execution or arbitrary plugin isolation in this
  task.

## Current Architecture Findings

### Server Runtime

- `python/sqlrooms-server/sqlrooms/server/server.py` exposes one WebSocket
  endpoint that multiplexes DuckDB query messages, uploadArrow binary frames,
  subscribe/notify messages, and optional CRDT messages.
- `python/sqlrooms-server/sqlrooms/server/__main__.py` starts a WS-only server
  with optional `--auth-token`, `--sync`, `--meta-db`, and `--meta-namespace`.
- `python/sqlrooms-server/sqlrooms/server/db_async.py` owns a process-global
  DuckDB connection, a shared query executor, query cancellation bookkeeping,
  metadata table initialization, and CRDT snapshot persistence.
- Metadata persistence currently creates:
  - `<meta_namespace>.ui_state`, with a generic `key` primary key.
  - `<meta_namespace>.sync_rooms`, keyed by `room_id`.
- Query execution accepts raw `arrow`, `json`, and `exec` SQL messages from any
  authenticated WebSocket connection.

### Auth

- `AuthManager` supports an optional single bearer token, but WebSocket auth
  state is keyed by remote address rather than the socket's stable connection id.
- The standalone server can require the token, but the CLI launcher starts the
  embedded DuckDB WebSocket with `auth_token=None` and relies on `local_only=True`.
- The CLI HTTP app generates a `session_token`, but `/api/config` and
  `/config.json` are unauthenticated and return runtime configuration.
- The CLI HTTP auth helper trusts loopback clients. That is appropriate for a
  local app, but can be unsafe behind a proxy, tunnel, or platform router.

### Sync

- `python/sqlrooms-server/sqlrooms/server/crdt/ws.py` lets the client choose any
  `roomId` in `crdt-join`.
- `packages/crdt/src/sync/webSocketSyncConnector.ts` has client support for
  joining a room, receiving a server snapshot, buffering local updates until the
  snapshot is applied, and reconnecting.
- `apps/sqlrooms-cli-ui/src/store.ts` enables WebSocket CRDT sync only when
  runtime config sets `syncEnabled`.
- The CLI UI currently mirrors document state into CRDT. Most room state,
  including artifacts, layout, dashboards, cells, AI sessions, DB settings, and
  app-builder state, still persists through whole-state UI persistence.
- `apps/sqlrooms-cli-ui/src/serverApi.ts` persists UI state to
  `<meta_namespace>.ui_state` under the single key `default`.

### Connection Lifecycle

- `packages/crdt/src/sync/webSocketSyncConnector.ts` already has reconnect
  behavior with backoff, local update buffering, snapshot-on-join handling, and
  reconnect after close/error.
- `packages/duckdb/src/connectors/WebSocketDuckDbConnector.ts` keeps a persistent
  WebSocket and lazily opens a new socket on the next query after close, but
  in-flight queries and uploads are rejected rather than resumed.
- Neither connector has an explicit "backend sleeping", "waking", or "waiting
  for ready" state.
- There is no coordinated client idle policy. A quiet tab may keep a CRDT socket
  open, while a reconnecting tab may repeatedly try to reconnect even if the
  backend intentionally hibernated.
- The server exposes `/healthz` and `/readyz`, but the frontend does not use them
  as part of a wake/readiness handshake.

### CLI and Runtime Config

- `SqlroomsHttpServer` starts the DuckDB WebSocket server in a background thread,
  serves the bundled UI, exposes `/api/*` endpoints, and builds runtime config.
- Runtime config derives `crdtRoomId` from
  `sqlrooms-cli:<meta_namespace>:<duckdb_database>`.
- Runtime config includes sensitive local convenience data such as `wsAuthToken`,
  AI provider API keys, DB path, and DB bridge metadata.
- The CLI is intentionally local-first today. `docs/deployment-scenarios.md`
  describes collaborative shared rooms with `sqlrooms-server` as coming soon.

## Proposed Implementation Approach

Introduce an explicit "single-session runtime" shape rather than a general
multi-tenant room server.

The session runtime should have one small configuration surface:

- `session_id`: stable id for this runtime/session.
- `room_id`: the only CRDT room this process accepts.
- `auth_token`: required token for HTTP and WebSocket access.
- `db_path`: DuckDB database for the session.
- `meta_db` and `meta_namespace`: metadata persistence location.
- `allowed_origins`: browser origins allowed to call HTTP APIs and connect to WS.
- lifecycle options: idle timeout, checkpoint behavior, and shutdown/export hooks.

The most important architectural move is to make the server own session identity.
Clients should receive the configured room id and endpoints, but should not be
able to choose arbitrary rooms, persistence identities, or authentication policy.

Use small modules where the interface earns leverage:

- A session runtime configuration module for parsing and validating the
  single-session contract.
- A per-connection auth module that can be reused by HTTP and WS surfaces.
- A CRDT room guard that rejects any client room id other than the configured
  room.
- A runtime config redaction/partitioning helper so public UI config and
  private server config do not blur together.
- A connection lifecycle layer that treats backend hibernation as expected:
  clients preserve local CRDT state, reconnect on activity, wait for readiness,
  and avoid keeping the backend alive unnecessarily.

Keep the local CLI behavior available by default, but add an explicit shared
session mode or launcher path that turns on stricter auth and fixed-room
behavior.

## Stages

### Stage 1: Define the Single-Session Contract

Create a documented session runtime configuration model without changing runtime
behavior yet.

Likely work:

- Add config types/helpers for `session_id`, `room_id`, `auth_token`,
  `allowed_origins`, `db_path`, `meta_db`, and `meta_namespace`.
- Decide command-line flags or environment variables for shared-session mode.
- Document how sprites.dev or another launcher would instantiate one runtime per
  session.
- Keep the current local CLI defaults unchanged.

Acceptance criteria:

- There is a clear, reviewed config contract for one-session-per-process.
- The contract distinguishes local CLI mode from shared-session mode.
- The plan for where secrets live is explicit: server-side config, not public
  runtime config.
- No behavior changes are required in this stage.

Files/modules likely to change:

- `python/sqlrooms-server/sqlrooms/server/__main__.py`
- `python/sqlrooms-server/sqlrooms/server/server.py`
- `python/sqlrooms-cli/sqlrooms/cli.py`
- `python/sqlrooms-cli/sqlrooms/web/launcher.py`
- `python/sqlrooms-server/README.md`
- `python/sqlrooms-cli/README.md`
- `docs/deployment-scenarios.md`

Tests/checks after stage:

- `uv run --project python/sqlrooms-server pytest`
- `uv run --project python/sqlrooms-cli pytest`
- `pnpm typecheck`
- Manual review of README/deployment docs for local vs shared-session language.

### Stage 2: Harden WebSocket Auth per Connection

Make WebSocket auth state connection-scoped and usable by both DuckDB query and
CRDT messages.

Likely work:

- Change `AuthManager` to track auth by stable connection id instead of remote
  address.
- Authenticate during or immediately after WS open using a consistent protocol.
- Ensure unauthenticated query, uploadArrow, subscribe/notify, and CRDT messages
  are rejected before any side effect.
- Add tests for multiple connections from the same remote address.
- Decide whether auth tokens are sent as first WS message, query parameter,
  subprotocol, or header. Browser support may make first message plus immediate
  server gating the simplest first step.

Acceptance criteria:

- Authenticating one WebSocket connection does not authenticate another
  connection from the same IP.
- Closing one WebSocket connection does not de-auth another active connection.
- All WS message classes are gated consistently.
- Existing unauthenticated local mode still works when auth is disabled.

Files/modules likely to change:

- `python/sqlrooms-server/sqlrooms/server/auth.py`
- `python/sqlrooms-server/sqlrooms/server/server.py`
- `packages/duckdb/src/connectors/WebSocketDuckDbConnector.ts`
- `packages/crdt/src/sync/webSocketSyncConnector.ts`
- `python/sqlrooms-server/sqlrooms/server/tests/test_auth.py`
- `python/sqlrooms-server/sqlrooms/server/tests/test_websocket.py`

Tests/checks after stage:

- `uv run --project python/sqlrooms-server pytest sqlrooms/server/tests/test_auth.py`
- `uv run --project python/sqlrooms-server pytest sqlrooms/server/tests/test_websocket.py`
- `pnpm test -- --runTestsByPath packages/crdt/__tests__/webSocketSyncConnector.test.ts`
- Add/verify client connector tests for auth failure and auth success.

### Stage 3: Add Fixed-Room CRDT Enforcement

Bind the server process to exactly one CRDT room in shared-session mode.

Likely work:

- Add an optional configured `room_id` to `sqlrooms-server`.
- When configured, reject `crdt-join` for any other room id.
- Ignore or reject client-sent `roomId` query params that do not match the
  configured room.
- Update CLI/shared-session runtime config to pass the server-owned `room_id` to
  the frontend.
- Keep unrestricted room ids available only in local/dev mode if still useful for
  tests or examples.

Acceptance criteria:

- A shared-session server accepts CRDT join for the configured room id.
- The same server rejects joins for any other room id.
- The frontend no longer derives shared-session room identity from DB path.
- Existing local CLI sync behavior remains compatible.

Files/modules likely to change:

- `python/sqlrooms-server/sqlrooms/server/__main__.py`
- `python/sqlrooms-server/sqlrooms/server/server.py`
- `python/sqlrooms-server/sqlrooms/server/crdt/ws.py`
- `python/sqlrooms-cli/sqlrooms/web/launcher.py`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `apps/sqlrooms-cli-ui/src/runtimeConfig.ts`
- `python/sqlrooms-server/sqlrooms/server/tests/test_websocket.py`

Tests/checks after stage:

- `uv run --project python/sqlrooms-server pytest sqlrooms/server/tests/test_websocket.py`
- `uv run --project python/sqlrooms-server pytest sqlrooms/server/tests/test_meta_storage.py`
- `pnpm test -- --runTestsByPath packages/crdt/__tests__/webSocketSyncConnector.test.ts`
- Manual two-tab CRDT smoke test against a shared-session server.

### Stage 4: Split Public and Private Runtime Config

Ensure browser-visible config contains only what the browser must know for the
current session.

Likely work:

- Require auth for shared-session `/api/config` and `/config.json`, or introduce
  a bootstrap endpoint with a non-secret invite/session token flow.
- Remove AI provider API keys from public runtime config in shared-session mode.
- Keep DB connector secrets server-side.
- Include only public connection metadata and the fixed `room_id`.
- Use the same session token for HTTP APIs and WebSocket connectors in
  shared-session mode.
- Revisit CORS and origin rules so `allowed_origins` is explicit and testable.

Acceptance criteria:

- A remote unauthenticated request cannot fetch useful session config.
- Browser config does not include provider API keys or local filesystem paths in
  shared-session mode.
- The UI can still connect to HTTP APIs, DuckDB WS, and CRDT WS after auth.
- Local CLI mode remains convenient and backwards-compatible unless explicitly
  launched in shared-session mode.

Files/modules likely to change:

- `python/sqlrooms-cli/sqlrooms/web/launcher.py`
- `apps/sqlrooms-cli-ui/src/runtimeConfig.ts`
- `apps/sqlrooms-cli-ui/src/serverApi.ts`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `packages/db-settings/src/DbSettingsSlice.ts`
- `packages/duckdb/src/connectors/WebSocketDuckDbConnector.ts`
- `packages/crdt/src/sync/webSocketSyncConnector.ts`
- `python/sqlrooms-cli/tests/test_launcher.py`

Tests/checks after stage:

- `uv run --project python/sqlrooms-cli pytest tests/test_launcher.py`
- `uv run --project python/sqlrooms-server pytest`
- `pnpm typecheck`
- Browser smoke test: load UI with shared-session config and verify no secret
  values appear in `/api/config`.

### Stage 5: Make Shared State Sync Complete Enough

Move the collaborative surface beyond document-only CRDT sync or explicitly
constrain the first shared-session product to document collaboration.

Likely work:

- Inventory room state slices and decide which are required for a useful shared
  session:
  - artifacts
  - layout
  - documents
  - dashboard configuration
  - notebook/cells
  - selected artifact/current UI state
  - AI sessions
  - DB settings
  - app-builder files
- Add CRDT mirrors for the required slices, or introduce server-side versioned
  commands for those slices.
- Avoid syncing ephemeral per-user UI state unless the product wants everyone to
  share it.
- Keep large data outputs and query results out of CRDT. Persist them in DuckDB
  or derived runtime state.

Acceptance criteria:

- Two browser clients in the same session converge for the selected shared state
  surface.
- Concurrent edits do not fall back to whole-state last-writer-wins persistence
  for shared slices.
- Per-user UI state is either intentionally local or intentionally shared.
- Restarting the session restores the shared state from server persistence.

Files/modules likely to change:

- `apps/sqlrooms-cli-ui/src/store.ts`
- `packages/crdt/src/*`
- `packages/documents/src/*`
- `packages/artifacts/src/*`
- `packages/layout/src/*`
- `packages/mosaic/src/*`
- `packages/cells/src/*`
- `apps/sqlrooms-cli-ui/src/serverApi.ts`
- Package README files for any new public CRDT helpers.

Tests/checks after stage:

- `pnpm test -- --runTestsByPath packages/documents/__tests__/documentsCrdt.test.ts`
- Add focused CRDT mirror tests for each newly synced slice.
- `pnpm test`
- `pnpm typecheck`
- Manual two-tab smoke test: create artifact, edit dashboard/document/notebook,
  reload both tabs, restart server, verify convergence.

### Stage 6: Add Session Lifecycle and Operational Guardrails

Add the minimum lifecycle controls expected from an on-demand session backend.

Likely work:

- Add startup health that validates DB path, metadata path, sync config, auth,
  and fixed room id.
- Add graceful checkpoint/flush hooks for DuckDB and CRDT state.
- Add optional idle timeout/shutdown callback behavior for platforms that stop
  inactive sessions.
- Add request and message limits:
  - max upload size and per-session upload directory.
  - max WebSocket payload size by mode.
  - query timeout or statement timeout where practical.
  - output row/byte limits for HTTP bridge endpoints.
- Add structured logs for session id, room id, connection lifecycle, auth
  failures, query start/end, and CRDT flushes.

Acceptance criteria:

- A shared-session runtime can start, report healthy/ready, accept users, flush
  state, and stop without losing recent CRDT changes.
- Operational limits are documented and have conservative defaults.
- Logs include enough identifiers to debug one runtime without exposing secrets.
- Local CLI behavior remains simple.

Files/modules likely to change:

- `python/sqlrooms-server/sqlrooms/server/__main__.py`
- `python/sqlrooms-server/sqlrooms/server/server.py`
- `python/sqlrooms-server/sqlrooms/server/db_async.py`
- `python/sqlrooms-server/sqlrooms/server/crdt/state.py`
- `python/sqlrooms-cli/sqlrooms/web/launcher.py`
- `python/sqlrooms-server/README.md`
- `python/sqlrooms-cli/README.md`

Tests/checks after stage:

- `uv run --project python/sqlrooms-server pytest`
- `uv run --project python/sqlrooms-cli pytest`
- Add tests for CRDT flush on close/shutdown.
- Add tests for configured upload/payload limit behavior where practical.
- Manual stop/restart smoke test with recent edits.

### Stage 7: Add Connection Reconnect and Hibernation Semantics

Make clients resilient to a backend that can be stopped during inactivity and
woken later on user activity.

Likely work:

- Define frontend connection states for DuckDB and CRDT:
  - connecting
  - connected
  - disconnected
  - sleeping
  - waking
  - ready
  - failed
- Add an activity-aware reconnect policy:
  - reconnect on focus, visibility change, user edit, query run, upload, or
    explicit retry.
  - avoid unconditional heartbeats that keep the backend warm.
  - close or pause idle DuckDB WebSocket connections.
  - decide whether CRDT should pause on hidden/inactive tabs once all local
    changes are flushed.
- Add a wake/readiness flow:
  - attempt a platform wake request if configured, or rely on the first HTTP/WS
    request to wake the runtime.
  - poll or await `/readyz` before reconnecting DuckDB and CRDT WebSockets.
  - reconnect CRDT, rejoin the fixed room, apply server snapshot, and flush local
    buffered updates.
- Treat in-flight DuckDB queries and uploads as non-resumable:
  - cancel/reject clearly if the socket closes.
  - let users rerun after the backend is ready.
- Treat CRDT changes as resumable:
  - keep local CRDT storage durable.
  - reconnect and sync once the backend wakes.
- Surface sleeping/waking/disconnected state in the CLI UI without blocking local
  reading of already loaded state.

Acceptance criteria:

- If the backend stops while the UI is open, the UI enters a clear disconnected
  or sleeping state rather than failing silently.
- User activity after backend shutdown triggers wake/readiness and reconnect.
- CRDT edits made while disconnected are retained locally and sync after
  reconnect, subject to the selected conflict semantics.
- In-flight queries/uploads fail with actionable errors and can be rerun after
  reconnect.
- Idle clients do not keep an on-demand backend alive only through heartbeat or
  unconditional reconnect loops.
- Local CLI behavior still feels immediate when no hibernation/wake endpoint is
  configured.

Files/modules likely to change:

- `packages/duckdb/src/connectors/WebSocketDuckDbConnector.ts`
- `packages/crdt/src/sync/webSocketSyncConnector.ts`
- `packages/duckdb/src/*`
- `packages/crdt/src/*`
- `apps/sqlrooms-cli-ui/src/store.ts`
- `apps/sqlrooms-cli-ui/src/runtimeConfig.ts`
- `apps/sqlrooms-cli-ui/src/components/*`
- `python/sqlrooms-cli/sqlrooms/web/launcher.py`
- `python/sqlrooms-server/sqlrooms/server/server.py`
- `python/sqlrooms-server/README.md`
- `python/sqlrooms-cli/README.md`

Tests/checks after stage:

- Add DuckDB WebSocket connector tests for close, lazy reconnect, and
  non-resumable query failure.
- Add CRDT connector tests for intentional sleep/pause, wake reconnect, and
  buffered local update sync.
- `pnpm test -- --runTestsByPath packages/crdt/__tests__/webSocketSyncConnector.test.ts`
- `pnpm test`
- `pnpm typecheck`
- Manual smoke test: start shared session, open two tabs, stop backend, edit
  locally where supported, trigger wake, verify reconnect and sync.

### Stage 8: Shared-Session Deployment Smoke Path

Create a repeatable local smoke path that approximates sprites.dev-style
session-backend deployment.

Likely work:

- Add a documented command or script to launch one fixed session runtime.
- Include sample environment variables for session id, room id, auth token, DB
  path, meta path, and allowed origins.
- Add a smoke checklist for two browser clients connecting to the same session.
- Document how a platform launcher should generate and pass the session token.
- Document how backend wake/hibernation is triggered and what readiness endpoint
  the client should wait for.
- Update deployment docs from "coming soon" to "experimental" only if the smoke
  path is reliable.

Acceptance criteria:

- A developer can launch one shared session locally with a fixed room id and
  token.
- Two clients can connect using that token and collaborate on the supported
  shared state.
- An unauthenticated client cannot fetch config, query DuckDB, or join CRDT.
- Restart restores persisted shared state.
- Hibernating or stopping the runtime during inactivity does not lose flushed
  shared state, and client activity can reconnect after wake.
- The documented deployment status matches the implementation maturity.

Files/modules likely to change:

- `docs/deployment-scenarios.md`
- `python/sqlrooms-server/README.md`
- `python/sqlrooms-cli/README.md`
- Optional smoke script under `python/sqlrooms-cli/scripts/` or
  `python/sqlrooms-server/scripts/`.

Tests/checks after stage:

- `pnpm build`
- `uv run --project python/sqlrooms-server pytest`
- `uv run --project python/sqlrooms-cli pytest`
- Manual shared-session smoke checklist from the docs.
- Manual hibernation smoke checklist from the docs.

## Risks and Open Questions

- Should shared-session mode live in `sqlrooms-server`, `sqlrooms-cli`, or a new
  thin launcher package? The local CLI currently mixes HTTP UI serving, DB
  bridge APIs, config writing, and the DuckDB WS backend.
- Should the browser receive an auth token in runtime config at all, or should a
  platform-provided invite token be exchanged for an in-memory session token?
- Which app state is truly shared? Documents are already CRDT-backed, but
  dashboards, cells, artifacts, layout, and AI sessions need explicit product
  decisions before mirroring.
- Should AI provider keys ever be used from the browser in shared-session mode,
  or should all AI calls be proxied through the server?
- How much raw SQL execution should collaborators get? A first shared-session
  server may accept full read-write DuckDB access, but that should be explicit.
- How should uploads be retained, garbage-collected, and associated with a
  session when the runtime is ephemeral?
- What persistence model should sprites.dev provide: durable volume, exported
  DuckDB files, object storage checkpoint, or something else?
- Does sprites.dev wake a runtime automatically on any HTTP/WS request, or does
  SQLRooms need an explicit configured wake endpoint?
- What should count as client inactivity: hidden tab, no active query, no dirty
  CRDT updates, no connected visible clients, or a platform-level idle signal?
- Should CRDT WebSockets stay connected while a tab is hidden, or should they
  disconnect after local changes are flushed so the backend can hibernate?
- Is per-user presence/cursor state in scope for the first collaborative release,
  or should it wait until shared document/dashboard state is stable?
- Should `subscribe`/`notify` channels be fixed/scoped in shared-session mode,
  or removed from the public protocol until a real use case needs them?

## Progress Log

- Not started.
