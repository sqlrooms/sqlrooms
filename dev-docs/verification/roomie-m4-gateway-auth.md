# M4 private gateway browser authentication — 2026-10-26

The private Sprite URL now opens Roomie using the existing Sprite browser login.
No Roomie launch ticket is needed on this explicitly configured deployment.
Local launch links, command revisions, explicit approvals and scoped agent MCP
credentials remain unchanged. PR #962 remains draft on its original base.

## Trust contract

`trustedGateway: true` in the managed service configuration gives the private
browser gateway its own loopback listener. The internal owner/MCP listener stays
separate. Only the gateway listener advertises and serves browser bootstrap;
forwarded headers cannot select it. Exact HTTPS origin/Host, JSON POST and
same-origin fetch metadata checks protect bootstrap against CSRF. Bootstrap
issues the existing bounded, expiring page credential, never an owner/MCP token.
The browser must explicitly opt into same-origin gateway authentication. Sessions
remain bound to the host instance, and a reload after restart replaces an old
binding without resubmitting commands.

The Sprite control plane was checked before deployment: `auth: sprite` and
`private_access: admins`. All gateway-authorized administrators act as the one
Roomie workspace owner; there is no per-person identity assertion. Local host
processes outside the harness are trusted administrators. The runtime does not
hold an organization token or continuously verify the gateway policy: operators
must keep this ingress private and disable gateway mode before making it public.
Hostname or forwarded headers alone are never proof of authentication.

Gateway mode refuses trusted-local and Docker harnesses, whose network access
would cross this boundary. Bubblewrap must use its private network and default
model origins; custom model origins are refused because they could route to the
browser ingress. No harness is also supported. Raw Loro writes and snapshot
seeding remain unavailable.

## Verification

- 102 native tests pass locally, including the existing real Docker regression
  cases. Nine Linux-specific cases are explicitly skipped on macOS and all nine
  pass on the actual Sprite, with zero skips and zero failures.
- The new real Bubblewrap probe cannot connect directly to the gateway port.
  Raw TCP requests through its broker receive 403 for both a forged public
  Host/Origin bootstrap request and an absolute gateway URL. The internal server
  also rejects bootstrap with forged forwarding headers. Existing Codex/Claude
  command, approval, namespace, deadline and watchdog cases remain green.
- Native gateway tests cover CSRF/header/method rejection, anonymous API denial,
  page credential scope, command commit, restart invalidation and document
  recovery. Access tests cover session capacity, expiration and closed access.
- All 40 shared MCP tests run with real DuckDB parsing and pass. The browser auth
  matrix verifies explicit opt-in, same-origin cookies, HTTPS, server capability,
  tab-session reuse, renewal and restart binding changes. Invalid supplied
  tickets still fail instead of falling back to gateway sign-in.
- 95 browser tests, 65 Node/Python conformance tests and five installed-package
  tests pass. Affected builds/typechecks, lint, Knip and circular checks pass.
  Independent review approved the boundary and final launcher change.

Reproduce the focused native checks after building the host:

```sh
node --test apps/roomie-node/test/access.test.mjs \
  apps/roomie-node/test/gateway.test.mjs
DUCKDB_TEST_PYTHON="$PWD/python/.venv/bin/python" \
  pnpm --filter @sqlrooms/mcp test --runInBand
```

The existing Linux Bubblewrap CI step now includes `gateway.test.mjs`. Use its
runtime provisioning and mount/procfs setup for all nine actual Linux cases.

## Deployed acceptance

The installed tarball was updated on `roomie-m4-lifecycle-20261026`, preserving a
stopped-workspace backup and the previous configuration. The service uses
Bubblewrap, browser ingress on port 8080, and an ephemeral internal MCP port.
A new browser tab opened the plain private HTTPS URL with no Roomie ticket and
rendered the connected document and its two-bar chart. A real service restart,
followed by reload of the same tab, restored sign-in and rendering. The final
launcher prints the plain public URL rather than minting an unused ticket.

Final deployed host PID 10581 recovered document `u55i7xr4qutdgdhcc9xad2bm` at
revision 2, the original receipt, and lifecycle fixture January/February values
300/450. Its execution lease drained. These are lifecycle fixture rows, not a
new measurement of the separate M2 order-grain/refund fixture, which is unchanged.
An unauthenticated POST with correct Origin/JSON still receives HTTP 302 to
Sprite authentication, not a Roomie session.

This slice does not complete aggregate hosted resource budgets or the two-hour
unattended soak. The known unrelated full-workspace MapLibre type mismatch is
unchanged. Six concurrent ai-core changes are excluded from this commit.
