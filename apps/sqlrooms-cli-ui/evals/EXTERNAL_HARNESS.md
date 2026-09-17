# Headless external harness evaluation

This milestone runs the actual Codex CLI with its native SQLRooms skill loading
and a real MCP Streamable HTTP connection. SQLRooms contains no AI slice,
artifact/chat links, model client, agent tools, or AI configuration in this target.
It runs the existing `document-charts-maps@1` profile against the two
`CLI_BEHAVIORAL_SCENARIOS`, both version **2**. It does not cover the third,
multi-turn scenario.

## Run

Prerequisites: workspace dependencies and built packages, Node 24.9+, an installed
Codex CLI supporting the options below, authentication for the selected provider,
and permission to bind a loopback socket. Tested with **codex-cli 0.143.0** and
**@modelcontextprotocol/sdk 1.30.0**. The runner defaults to `gpt-5.5` with medium
reasoning. By default, local runs use existing Codex authentication (`codex login`)
and `gpt-5.5`. Set `SQLROOMS_EVAL_PROVIDER=openrouter` to route the actual Codex
process through OpenRouter's Responses endpoint with `OPENROUTER_API_KEY`; no
ChatGPT login is needed in that mode. `SQLROOMS_EVAL_MODEL` selects the model in
both this mode and the embedded Promptfoo evaluator. OpenRouter mode defaults
locally to `deepseek/deepseek-v4-flash-0731` if no model override is supplied.
CI requires the shared repository variable explicitly. Local OpenRouter runs can
load credentials/model from `.env.local`, as the embedded target does.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter sqlrooms-cli-app evals:external:build
# From the repository root; the output directory MUST NOT already exist.
node apps/sqlrooms-cli-ui/evals/run-external.mjs /tmp/sqlrooms-external-attempt-01

# Same provider/model as the CI jobs (OPENROUTER_API_KEY in env or .env.local):
SQLROOMS_EVAL_PROVIDER=openrouter SQLROOMS_EVAL_MODEL=deepseek/deepseek-v4-flash-0731 \
  node apps/sqlrooms-cli-ui/evals/run-external.mjs /tmp/sqlrooms-openrouter-attempt-01
```

Each scenario gets a fresh Node DuckDB fixture and workspace. The harness runs in
a temporary directory containing only the skill and host instructions. The
canonical source is `../skills/sqlrooms`; it is copied into
`.agents/skills/sqlrooms`, discovered by Codex, and invoked with `$sqlrooms` before
the unchanged scenario prompt. Connection/policy metadata is supplied separately.
The model never receives the checks or expected snapshots from the runner.

The exact invocation is saved in each evidence envelope. Its shape is:

```text
codex exec --ignore-user-config --ignore-rules --ephemeral
  --skip-git-repo-check --sandbox read-only --json --color never
  -C <temporary-workspace> --model gpt-5.5
  -c model_reasoning_effort="medium"
  -c mcp_servers.sqlrooms={url=<local-url>,bearer_token_env_var="SQLROOMS_EVAL_MCP_TOKEN",required=true,...}
  -c mcp_servers.sqlrooms.default_tools_approval_mode="approve"
  '$sqlrooms\n\n<unchanged scenario turn>'
```

The token is random per host and passed only in the child's environment. User
configuration and execpolicy rules are not loaded, so unrelated user-configured
MCP servers/hooks do not participate. Other locally discoverable user, admin, bundled, and cached plugin skill paths
are disabled with supported per-invocation `skills.config` entries; their paths
are recorded in the manifest. User settings and authentication files are not
changed or copied. The selected SQLRooms skill and successful reads are recorded.
OpenRouter mode adds `model_provider="openrouter"` and a provider definition with
`base_url="https://openrouter.ai/api/v1"`, `wire_api="responses"`, and
`env_key="OPENROUTER_API_KEY"`; the key value is passed only in the environment,
never in invocation arguments. The model's provider is recorded as `openrouter`,
while the target remains `cli-external-codex`. SQLRooms still owns no model client
or reasoning loop in this target. Codex's shell is read-only, but that is not a
complete host filesystem sandbox.
The temporary working directory and instructions prevent accidental evaluation
source access; they are not an adversarial anti-cheating boundary.

Native skill discovery and MCP configuration follow the
[Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) and
[MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
This is one direct harness path; native specialist delegation is not established.

## Composition decision and fidelity

The executable spike demonstrated that domain commands and owned map lifecycle
work without AI. The smallest useful boundary is **app-local
`createCliDomainSlice`**, assembling the room/database/command slices, artifacts,
block documents, maps, and profile command registration. The production browser
store, embedded evaluation target, and external workspace all use it. This
removes the old evaluation-specific slice assembly and fake dashboard adapter.

`createCliCapabilityRuntime` injects a store and mandatory host policy into the
existing `createRoomCapabilityRuntime`. Both it and the browser `CliMcpBridge`
use the same six capability handlers. Command serialization belongs to each
runtime, rather than a module-global queue. The shared `block-document.inspect-block`
command takes explicit `artifactId` and document `blockId`, validates document
membership, and returns the block plus backing state where applicable. Stateful
types provide a `readState` callback through the existing document command type
registry. The map registration owns its lookup; the document command knows no
map-specific state. Unsupported readers and missing instances fail explicitly,
and reads never initialize state. This replaces the milestone's original
`block-document.get-map` command. Skill v4 and isolated policy v2 use the generic
command; historical evidence retains its original command IDs and versions.

Hosts may project command discovery metadata through `describeCommand` without
replacing handlers or changing registry entries. The isolated host uses this to
make `block-document.get` require a non-empty `artifactId` in `get_command` and
explain explicit targeting in `search_commands`. Its policy still enforces that
requirement. The browser keeps the shared command's optional current-document
default. A denied call remains an evaluation error even if the harness recovers.

| Layer                                                    | Browser                                                 | Embedded evaluation                                | External evaluation            |
| -------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| Domain slices, document artifact hooks, profile commands | Shared                                                  | Shared                                             | Shared                         |
| Connector                                                | Existing browser/server connector                       | DuckDB Node fixture                                | Same Node fixture              |
| Artifact registry                                        | Renderers and all persisted types                       | Same type IDs/capability flags; document lifecycle | Same headless registry         |
| AI                                                       | Existing AI, settings, session middleware, specialists  | Same production tools/profile, injected model      | Absent                         |
| Lifecycle                                                | Browser initialization and persistence                  | Domain + AI teardown                               | Domain + connector teardown    |
| Host services                                            | Layout, other profile slices, CRDT, persistence, Python | Omitted                                            | Omitted                        |
| Capability policy                                        | Existing per-query approvals                            | Embedded command/tool policy                       | Explicit isolated policy below |

Some existing CLI command factories remain typed for the full browser `RoomState`.
The single headless type adaptation is documented in `createCliHeadlessWorkspace`;
the concrete profile exposes only supported domain commands. It does not add
placeholder AI/session state or promise that other profiles are headless.

## Isolated evaluation policy

`EXTERNAL_EVAL_POLICY` is trusted host configuration saved in every run. It allows
the six shared capabilities, bounded SELECTs, and only the document list/get,
map get, document/chart/map creation, block update, and append commands required
by the suite. Targeted commands require explicit document IDs. Other commands,
caller-provided confirmation, and implicit current-document targeting are denied.
Command input validation and existing high-risk/confirmation gates still apply.

The database is in memory with only the existing ambiguous geospatial fixture.
After the connector loads its required Arrow extension and fixture, the host sets
`enable_external_access=false`. The shared parser still rejects non-SELECT SQL,
internal metadata access and dynamic table references. Neither SELECT validation
nor this evaluation policy is an OS sandbox, a general SQL authorization system,
or a query CPU/memory budget. Production query permissions are unchanged.

## Grading, evidence, and failures

The runner uses the existing shared seed, normalized snapshot function,
`createCliScenarioChecks`, `evaluateBehavioralChecks`, and `RunEvidenceSchema`.
It does not author or repair agent output after seeding. Grades use the final
assistant answer, not interim plans. No LLM grader is involved.

Every attempt has an exclusive directory with a manifest written before execution,
scenario/profile versions, revision/dirty state, execution bundle hash, harness
version, skill/reference hashes, policy, exact invocation, raw harness JSONL and
stderr, independent SQLRooms request/result and mutation events, fixture/final
snapshots, and check results. Usage is reported when Codex emits it; configured
model identity is distinguished from the unobserved resolved backend identity.
Raw logs may contain synthetic fixture content and local paths; inspect them
before sharing outside your team. Credentials are not copied into evidence.

A missing CLI, failed login, failed transport, missing observed skill read, timeout,
cancellation, operation failure, or cleanup failure is an error, never a passing
skip. Behavioral check failures are separate. Four-minute scenario limits,
30-second capability limits, bounded inputs/results, an 8 MiB process-output cap,
and process-group termination bound harness execution. The executable also runs
the complete suite in a supervised child with a nine-minute deadline and a
ten-second cancellation grace period, including setup, grading, and cleanup. `finally` closes MCP and its
connections, disposes the runtime/store/DuckDB, and removes the temporary skill
workspace. Runtime draining waits for actual handlers/commands, not just their
cancelled caller promises. If a stage cannot settle within the grace period,
the supervisor kills the worker and remaining harness groups, removes reported
temporary directories, and records `supervisor.json`; forced termination is never
a pass. SQLRooms/DuckDB resources are then reclaimed with the worker process. POSIX process groups are used; Windows is not verified.

There are **no automatic reruns**. Keep all failed directories. Record the cause
and change before starting a new attempt. Retain full runs as local or hosted
artifacts outside Git; commit concise delivery records with artifact locations
and checksums. Preserve failed attempts in the same archive as successful ones. Infrastructure retries must use a fresh
fixture. A successful two-scenario demonstration establishes feasibility, not a
reliability rate or equivalence of orchestration. The embedded live suite is a
separate before/after comparison, never a substitute for the external harness.

## CI placement

Deterministic MCP discovery, policy, and lifecycle tests already run in the PR
workflow's CLI tests and `evals:test`. The explicit-target discovery regression
belongs there; it needs no model credentials.

The `external-document-canary` job runs alongside the embedded Promptfoo job in
`evals-nightly.yml`, on the same nightly schedule and manual dispatch (both targets by default, or
select one target for a declared follow-up). Both use
`secrets.OPENROUTER_API_KEY` and `vars.SQLROOMS_EVAL_MODEL`. The repository variable
starts at `deepseek/deepseek-v4-flash-0731`; change it in Settings → Secrets and
variables → Actions → Variables to change both targets. Missing configuration is
an explicit failed step, never a passing skip. The canaries remain non-blocking.

The external job installs pinned `@openai/codex@0.143.0`, builds the target, runs
both scenarios once (the embedded suite runs three repetitions), and retains
manifest, raw harness output, evidence envelopes and supervisor status for 30
days even on failure. Model compatibility with Codex/OpenRouter Responses is an
evaluation prerequisite; the runner does not silently switch models or providers.
On Ubuntu 24.04, CI installs Bubblewrap and the distribution AppArmor profile,
then proves that the Codex sandbox can read repository files and rejects writes
before starting the model. This follows [Codex sandbox prerequisites](https://learn.chatgpt.com/docs/sandboxing)
without disabling the system user-namespace restriction. Custom models can emit a
known fallback-metadata diagnostic; it is retained as a warning, while unexpected
diagnostics and failed turns remain errors. Fallback metadata is a harness
compatibility limitation, not proof of model-specific tuning.

CI evidence is uploaded as workflow artifacts, never committed. Existing local
attempts remain local. Independent statuses and evidence preserve the distinction
between the embedded AI loop and the actual external harness. Same model does
not imply identical reasoning settings or orchestration.

Codex custom-provider configuration and environment authentication are documented
in [OpenAI's authentication guide](https://learn.chatgpt.com/docs/auth#alternative-model-providers)
and [OpenRouter configuration example](https://learn.chatgpt.com/docs/security/sdk).

## Milestone evidence and exclusions

See [the delivery record](evidence/headless-delivery/README.md) for attempts,
regression results, and outstanding verification. The implementation and skill
are small app-local adapters, not a production plugin distribution or universal
runner API.

Browser external mode, imports, rendered/capture correctness, production
persistence/restart, WebMCP, and additional harnesses remain outside this milestone.
Embedded specialist routing, session links, models, and tools are retained.

## Claude Code adapter

The same supervised suite can run actual Claude Code with the native SQLRooms
plugin, the same real MCP host, domain runtime, policy, fixture, scenarios,
snapshots and independent checks:

```sh
pnpm --filter sqlrooms-cli-app evals:external:build
SQLROOMS_EVAL_HARNESS=claude node apps/sqlrooms-cli-ui/evals/run-external.mjs /tmp/sqlrooms-claude-attempt-01
```

Prerequisites are installed/authenticated Claude Code and access to its configured
provider. Tested loading with Claude Code 2.1.260. The adapter uses supported
`--plugin-dir`, `--mcp-config`, `--strict-mcp-config`, and print-mode stream JSON.
It pre-approves reads only beneath the staged plugin guidance directory, the
SQLRooms skill, and SQLRooms MCP tools, and requires successful native
Skill invocation, a full skill read, and focused reference reads before accepting
a run. The exact CLI invocation, model reported by actual assistant events,
provider errors, MCP calls, raw streams and cleanup remain separate evidence.
Synthetic authentication-error messages do not establish a resolved model.

Claude uses its own authentication and default model; `SQLROOMS_CLAUDE_EVAL_MODEL`
can explicitly override the evaluation model. Codex/OpenRouter environment
configuration and `.env.local` are not translated into Claude configuration.
Claude's user settings and discoverable skills remain its own; `--strict-mcp-config`
limits MCP servers, not skill discovery or filesystem reads. This is not an
adversarial isolation boundary. Tokens are environment references in the MCP
config, and the runtime/skill workspace is removed in `finally`. The existing
Codex command and CI jobs are unchanged.

Canonical skill v5 corrects the browser chart example to `count-plot` with
aggregate settings and uses block `caption` for a visible title. Browser testing
found that the previous `bar` example passed the existing state checks but was
not a registered renderer. Scenario fixtures and behavioral expectations are
unchanged; in particular the existing mutation fixture still includes that
legacy state-only chart config. Headless success does not prove rendering.

See [Claude delivery evidence](evidence/claude-plugin/README.md). The supported
native mechanisms are described in Anthropic's [plugin guide](https://code.claude.com/docs/en/plugins),
[CLI reference](https://code.claude.com/docs/en/cli-reference), and
[MCP environment configuration](https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcpjson).
