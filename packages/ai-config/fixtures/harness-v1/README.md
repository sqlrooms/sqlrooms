# Run contract v1 recordings

`codex-revenue.json` is a normalized real Codex CLI 0.163.0 recording from
2026-10-25. The database contained only synthetic rows from
`apps/roomie-node/test/live-m2.mjs`. Codex inspected the knowledge definition,
verified order grain and refund exclusion, and authored a chart document through
shared commands: January 300, February 450. Event IDs, sequence, synthetic
messages, and tool names/statuses are retained. Raw tool input/output, blobs,
account/configuration diagnostics, and filesystem paths are deliberately omitted.
This is model evidence, not a scripted success fixture.

Claude Code 2.1.310 was attempted on the same date but authentication expired
before model work. Successful Claude recordings remain unverified until owner
sign-in. Do not treat this as second-harness validation; that adapter is M4.

Scripted host tests separately cover approval/denial, cancellation, deadline,
interrupted recovery, unknown events, and reconnect; these are protocol doubles.
