# Local authentication

The CLI binds HTTP, MCP, and DuckDB listeners to loopback. Every workspace
operation requires a credential, including requests from localhost. This boundary
protects against unsolicited web pages and accidental local callers; it does not
sandbox SQL or isolate hostile processes running as the same OS user.

## Browser launch and recovery

The launcher opens a URL with a single-use ticket in its fragment. Tickets expire
in two minutes. The bootstrap removes the fragment before importing the workspace
UI and exchanges it for a 30-minute page credential. Only that page credential can
retrieve embedded AI configuration (including configured provider keys). External
mode omits provider keys. Neither config alias returns the native control token.

The credential is stored in `sessionStorage`, keyed by origin, database generation,
and page purpose. Reload retains authorization. A new tab requires a fresh launch
link unless the browser copied its opener's storage; the existing single-page MCP
lease still applies. App-opened tabs must use `noopener`. When storage is blocked,
authorization stays in memory and reload requires a new launch link. A bare URL
shows recovery instructions.

The browser renews one minute before expiry through an authenticated POST. Renewal
retains the credential, scope, binding, sockets, and bridge lease. Failure never
extends expiry. Domain frames recheck authorization; idle sockets close within
one second of expiry/revocation. Browser suspension may miss renewal and require a
fresh link. A stale/half-open bridge becomes replaceable after its 30-second lease
timeout; a clean disconnect releases it immediately.

With `--no-open-browser`, the launcher writes a temporary link directly to an
interactive terminal, not its logger. Treat the link as a temporary credential.
Non-interactive clients obtain a fresh link through protected `POST /api/auth/ticket`
using the native credential. Tickets and credentials must not enter telemetry,
repository files, persisted logs, or shared agent configuration.

## Native clients and `--no-ui`

Startup reports the path of a temporary credential file. Its POSIX directory is
owner-only (`0700`) and its file is `0600`. Set `SQLROOMS_CREDENTIAL_FILE` to that
path in a native consumer; read it using `sqlrooms.web.security.read_credential_file`.
The record includes `token`, `binding`, `apiUrl`, `mcpUrl`, and `wsUrl`. Reject unsafe
owners, permissions, or symlinks. Windows ACL support is not implemented or claimed.
No raw tokens belong in process arguments or logs.

Send `Authorization: Bearer <token>` on native HTTP requests. On the direct DuckDB
websocket send `{"type":"auth","token":"<token>"}` first, and consume `authAck`
before sending SQL or binary frames. Authentication has a five-second deadline and
4 KiB handshake limit. Native clients without Origin still require authentication.
The CLI's direct backend rejects browser Origins; the browser uses `/ws/duckdb`.

Foreground Claude receives only the credential-file path and a header-helper
command. Its `headersHelper` reads the protected file and verifies the MCP endpoint,
using a dedicated helper output pipe, never MCP stdin/stdout. No global Claude
configuration is changed. Deterministic Claude evals use the same file handoff;
Codex's adapter retains its required child-only bearer environment interface.

`--no-ui` supports authenticated HTTP/native SQL access. Browser-backed MCP still
requires the browser; `--mcp --no-ui` remains unsupported. Query approval and command
validation are unchanged.

## Route and scope inventory

| Surface                                                  | Required authority                                     |
| -------------------------------------------------------- | ------------------------------------------------------ |
| Static UI, `/healthz`, `/auth.json`                      | Public; only minimal health or opaque binding identity |
| `POST /api/auth/exchange`                                | Valid single-use ticket, allowed Host/Origin           |
| `/api/config`, `/config.json`                            | Current page credential and `page-config`              |
| Detailed status, DB settings GET                         | `read`                                                 |
| AI/DB settings PUT                                       | `config-write`, checked before file/in-memory changes  |
| Upload, DB queries/catalog/cancellation, project queries | `query`                                                |
| MCP start/stop                                           | `control`                                              |
| Ticket issuance                                          | Native `bootstrap`                                     |
| Renewal                                                  | Page `renew`                                           |
| HTTP MCP discovery and tool calls                        | Native `mcp`, on every request                         |
| Browser bridge                                           | Page `bridge`, plus the existing single-page lease     |
| DuckDB domain messages                                   | `query`, per connection and every JSON/binary dispatch |
| Backend `/healthz`, `/readyz`                            | Public minimal text                                    |
| Backend `/version`                                       | Authenticated when backend auth is enabled             |

The proxy consumes browser auth messages and separately authenticates upstream with
a server-only query credential, consuming its acknowledgement before forwarding
frames. Credentials cannot be supplied through websocket query strings. Repeated
browser auth frames never enter the native boundary.

HTTP responses are no-store and no-referrer. Host and Origin checks supplement
credentials. Forwarded identity headers and routing identifiers never establish
authority. CORS preflight is allowed only after transport checks. Generic connector
errors are redacted; authorized reads still include non-secret connector metadata.

## Development and lifecycle

`pnpm dev cli` configures the exact Vite origin and proxies bootstrap, API, and both
websocket routes. For a separately started UI, set `SQLROOMS_ALLOWED_ORIGINS` to the
comma-separated exact UI origins (including ports) on the backend. There is no
wildcard localhost-port exemption. Browser credentials go only to the page origin;
proxy `/auth.json`, `/api`, and `/ws` to the same instance. Cross-origin redirects
are rejected. Restarting a backend changes the binding even when ports are reused.

Reverse proxies mounted below a path must forward the launch directory (for
example `/sqlrooms/`) and strip that prefix upstream. The UI resolves its assets,
bootstrap, API, renewal, and websocket routes within that directory. Use the
generated launch link, which includes the trailing slash.

The Sprite installer keeps the SQLRooms listener on loopback and configures the
Sprite HTTP proxy's service port. It polls public `/healthz`; opening the workspace
still requires a ticket obtained through the private native credential handoff.

`LocalAccess.invalidate()` revokes native, upstream, and page credentials and all
outstanding tickets. Shutdown invokes it and deletes the native handoff file, even
on startup failure. A future successful Save As must invalidate the source binding,
issue destination authority, replace its private runtime record, and explicitly
bootstrap/retarget consumers. This PR does not implement Save As, managed catalogs,
cloud login, OAuth, or a generic role system.

The standalone `sqlrooms-server` API keeps its existing optional-auth compatibility;
applications using it directly must configure authentication and allowed transports.
The CLI always supplies the verifier and explicit allowlists.
