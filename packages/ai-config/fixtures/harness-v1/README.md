# Run contract v1 recordings

The manifest identifies six real recordings from 2026-10-25. These are synthetic
workspace/model evidence, separate from the scripted host protocol doubles.

| Recording                     | Evidence                                                                                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex-revenue.json`          | Codex CLI 0.163.0 completed a browserless revenue report through shared commands: January 300.00, February 450.00.                                                                                                                                             |
| `codex-interrupted.json`      | A later real Codex run was interrupted by host shutdown. Its durable events and committed document revision survived restart. Original workspace sequence 222–276 is retained.                                                                                 |
| `claude-short-answer.json`    | Claude Code 2.1.310 returned a successful short answer.                                                                                                                                                                                                        |
| `claude-roomie-tools.json`    | Claude inspected knowledge, checked grain/refunds with SQL, and made 20 MCP calls, including a durable chart-document creation. Native permission requests received explicit test-operator approvals. A failed query and subsequent correction remain visible. |
| `claude-approval-denied.json` | One native MCP permission request was denied. Claude reported the denial without retrying or executing the tool. The model turn succeeded; the tool did not.                                                                                                   |
| `claude-cancelled.json`       | The recorder sent native `interrupt` while a permission request was pending. Claude cancelled that request and exited without executing it. The run and tool are cancelled; no owner approval is invented.                                                     |

Claude's report uses the synthetic data from
`apps/roomie-node/test/live-m2.mjs`. Both the base orders/refunds query and the
approved `recognized_revenue` table returned 300.00 and 450.00, with two orders
per month. Authenticated committed-content inspection confirmed document
`awmqfvy17nl7xx7osenvlrtf` at revision 1, a line chart over
`recognized_revenue`, and the definition, SQL, and exact values. The creation
receipt carries operation ID `claude-revenue-fixture-create-v1`.

## Provenance and limits

Codex fixtures come from the production host's durable event log. Claude
fixtures are **offline normalizations of real native stdio**, not events from a
live Claude host adapter. The recorder supplies lifecycle envelopes and native
permission decisions; terminal success requires both a successful native result
and a clean process exit. Pending native requests are invalidated on cancellation
or exit, with `resolvedBy: recorder`, never represented as an owner grant.
The manifest's Claude source hashes identify the private original captures.

Only completed assistant text is retained; partial text frames are omitted to
avoid duplicate display. Event identities, synthetic messages, tool
names/statuses, permission decisions, numeric usage, and durable artifact receipt
references are retained. Native initialization and lifecycle notifications use
the generic unknown-event fallback. Raw tool inputs/outputs, reasoning,
configuration/account diagnostics, filesystem paths, and blobs are omitted.
Synthetic message text still needs manual inspection before publishing: the
normalizer is not a general-purpose secret scrubber.

The recorder disables built-in tools, user/project settings, hooks, automatic
skill discovery, and inherited MCP servers. Only the explicitly supplied local
Roomie MCP server is available. It injects the portable Roomie skill text as
context; this does not verify Claude skill-package discovery. Native permissions
are answered by the test operator's scenario policy, not by a person clicking the
Roomie UI. A live second adapter, its durable supervision, and skill discovery
remain M4. Scripted host tests separately cover deadline, process crash during
approval, recovery, and protocol races.

## Re-recording

Use an authenticated Claude CLI and a **fresh synthetic workspace**. Build the
workspace packages and `roomie-node` first. From `apps/roomie-node`, start the
synthetic host in one terminal:

```sh
ROOMIE_M2_DIRECTORY=/tmp/roomie-claude-fixture pnpm exec node test/live-m2.mjs --seed
```

In another terminal, from the same app directory, choose `short`, `tools`,
`denied`, or `cancel`:

```sh
node test/record-claude-fixtures.mjs /tmp/roomie-claude-fixture short
```

The opt-in recorder creates a private capture directory, uses a private MCP
configuration handoff, and removes that configuration when the child exits.
It bounds wall time, stdout bytes/frame size, and stderr. SIGINT/SIGTERM stops
its native process group and performs cleanup. It never uses permission bypass.
Do not point it at a personal workspace: the `tools` scenario explicitly approves
Roomie MCP calls to create a synthetic report.

To normalize the printed capture path, run from the same app directory:

```sh
node --input-type=module - /absolute/private/capture.json > normalized.json <<'JS'
import {readFileSync} from 'node:fs';
import {normalizeClaudeRecording} from './test/normalize-claude-recording.mjs';
const records = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(normalizeClaudeRecording(records), null, 2));
JS
```

Inspect normalized synthetic text and receipt references before copying a fixture
here and updating the manifest. Never commit raw captures or MCP credentials.
The shared `ai-core` tests validate every manifest fixture against v1 schemas,
replay across a disconnect (including during pending approval), deduplicate
redelivery, preserve visible text/outcomes, and exercise a real receipt's document
navigation through `HarnessRunDetails`.
