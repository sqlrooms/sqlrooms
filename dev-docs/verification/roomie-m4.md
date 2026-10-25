# Roomie M4 inventory and second live harness

Baseline: `77bd78193417387b2363cbc47c427d73defce91f`, existing worktree and draft
PR #962 on `feat/roomie-node-workspace`. Baseline CI passed; no base change.
The current host and chat UI plans were read before editing.

## Remaining gaps

| Area                              | Starting evidence                                            | Work still required                                                                                                          |
| --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Second live harness               | Codex production adapter; Claude offline recorder only       | Live Claude adapter, shared skill discovery, approvals, events, receipts, browser/recovery acceptance                        |
| Enforced isolation                | Explicit trusted-local subprocess mode; renderer SQL policy  | OS identity/sandbox, exchange boundary, locked DuckDB configuration and real bypass tests across shell, files, SQL and Quack |
| Distribution and hosted lifecycle | Node prerequisite and development entry point; loopback HTTP | Local launcher, Sprite deployment/service, renewable work leases and external watchdog                                       |
| Unattended acceptance             | Local restart/reconnect and deadlines                        | Approximately two-hour deployed run, cold recovery, approval waits and observed idle shutdown                                |

This slice implements the first row. The remaining rows are still release gates;
CLI restricted mode and disabled tools do not establish OS isolation.

## Adapter and contract

The supervisor owns credential revocation, durable owner decisions, one active
run, deadline, command drain and terminal publication for both adapters. Native
Codex event translation is extracted without changing its behavior. Claude Code
2.1.310 uses bounded stream-json stdio and the same MCP commands and event schema.
Both adapters produce existing shared chat events; there is no Claude UI branch.
New runs store an optional `harness` identifier; older v1 records remain valid.

Claude accepts only the explicitly configured Roomie MCP server and Skill tool,
checks its native version/tool configuration, and fails closed for unknown host
requests. Every native permission request waits for a durable owner decision.
Success requires a non-error native result, successful process exit and no
unresolved calls/permissions. Cancellation kills the process group and revokes
its token before terminal publication. Native cancellation of a permission
interrupts the run rather than reusing the stale native request ID.

Both adapters consume identical canonical SKILL.md bytes, identified by SHA-256.
Claude discovers a separate per-run plugin copy as `roomie:roomie`; initialization
must advertise it before the host sends `/roomie:roomie` with the prompt. The
initial restricted-mode probe failed to discover a project skill, so explicit
plugin discovery was added and verified. The skill body is not substituted into
a system prompt. The generated plugin manifest is adapter configuration.

| Capability                                         | Codex | Claude |
| -------------------------------------------------- | ----- | ------ |
| Cancellation and owner approvals                   | Yes   | Yes    |
| Usage reporting                                    | No    | Yes    |
| Live input, native continuation, approval recovery | No    | No     |
| Reasoning summaries and plan updates               | No    | No     |

A new turn in an existing conversation starts fresh native context. Host restart
interrupts in-flight work and invalidates native approvals; it never fabricates
continuation. Unknown native envelopes are summarized, avoiding persistence of
Claude initialization account/configuration data.

## Verification

- All 73 native tests pass, including 13 Claude regressions for approvals,
  cancellation, deadline, invalid configuration, output bounds, failed native
  results/exits, known-token redaction, stable skill bytes, receipts and errors.
- All 65 Node/Python conformance tests, 460 ai-core tests and 3 ai-config tests
  pass. Host/public-schema builds and typechecks, package lint (one pre-existing
  migration warning), Knip and circular-dependency checks pass.
- Independent review approved the adapter extraction and result decoder. Three
  receipt/failure regressions also passed independently.
- A live Claude report run produced 219 durable events and created document
  `t8h8y74y34l3jacwqwmcuceh`, revision 1, operation
  `claude-m4-revenue-create-v2`. It inspected knowledge and grain, verified whole
  order refund exclusion, and returned January 300.00 / February 450.00. A policy
  refusal and malformed first document input were shown as failed tool calls;
  the corrected request committed exactly one report.
- Browser inspection rendered the shared line chart over `recognized_revenue`,
  exact values, source SQL and conversation. The shared tool receipt link opened
  the correct document. No harness-specific UI code was added.
- Live owner denial prevented the requested tool action without retry. Live
  cancellation cleared the pending approval. Browser closure left another
  approval pending; graceful host shutdown/reopen interrupted that run, removed
  its pending approval and rejected the stale approval with HTTP 409. All 219
  report events replayed identically, and the document/chart rendered after
  restart. This is local restart evidence, not a hosted crash or soak claim.
- Final pushed-head CI is recorded in the current plan. Private raw captures
  (including account metadata) are not committed; durable synthetic event
  evidence is separate from native captures.

## Reproduction

Build workspace packages/viewer first, then the host. For a fresh synthetic
workspace, from `apps/roomie-node`:

```sh
ROOMIE_HARNESS=claude ROOMIE_M2_DIRECTORY=/tmp/roomie-m4-demo \
  node test/live-m2.mjs --seed
```

Omit `--seed` to reopen. Authenticate Claude 2.1.310 beforehand. The default remains
Codex 0.163.0. The host prints a fresh single-use browser ticket; never put the
owner credential in a URL. Drive `/api/runs/start`, `/api/approvals/resolve` and
`/api/runs/cancel` with the existing owner API, or use the existing browser chat.

References: [Claude CLI](https://code.claude.com/docs/en/cli-reference) and
[skill discovery](https://code.claude.com/docs/en/skills). Capability claims are
limited to the pinned version actually exercised.
