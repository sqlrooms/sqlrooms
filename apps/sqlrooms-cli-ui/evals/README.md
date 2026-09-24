# SQLRooms production-model behavioral evals

The nightly suite runs the production `document-charts-maps@1` CLI profile
through the in-process target. Promptfoo schedules and retains runs; SQLRooms'
deterministic state and policy checks decide pass/fail. No LLM grader is used,
so application token usage remains separate from the zero grader usage recorded
in the evidence envelope.

## Run locally

Build workspace packages, copy the local environment template, set an OpenRouter
key in `.env.local`, and run either the whole suite or one scenario.
`evals:nightly` first creates the Node provider bundle used by Promptfoo,
avoiding browser-only CSS/module imports from application barrels:

```sh
pnpm build
cp .env.example .env.local
# Edit .env.local and set OPENROUTER_API_KEY.
pnpm evals:nightly
pnpm evals:nightly --filter-pattern 'document.create-chart-map'
```

An existing environment variable takes precedence over `.env.local`. The
nightly GitHub Actions workflow supplies `OPENROUTER_API_KEY` from GitHub
Secrets, so CI does not depend on a local environment file.

Both nightly jobs use the repository variable `SQLROOMS_EVAL_MODEL` for the
OpenRouter model ID, initially `deepseek/deepseek-v4-flash-0731`. Export the same
variable locally to override the local default. The resolved model is recorded
in each evidence envelope, so provider labels do not claim a fixed model.
For the embedded Promptfoo evaluation, temperature (0), maximum steps (24),
scenario/profile versions, and three repetitions remain fixed. The external
Codex harness uses the same scenario/profile versions, runs each scenario once,
and uses medium reasoning. Provider-reported costs are retained; fallback estimates
use the existing DeepSeek rates only for that exact model and remain unknown for
other models when billing metadata is absent. Promptfoo stores its
SQLite database beneath `PROMPTFOO_CONFIG_DIR` (or its normal user config
directory). The CI job uploads that database plus JSON and compact Markdown
summaries for 30 days. Provider/transport errors are tagged separately from
behavioral check failures in provider metadata.

The scripted-model test in Jest is wiring coverage only. It proves the real
transport/tool/state path is connected without credentials or network access;
it is not evidence of production-model behavior.

## External harness

The separate [headless external target](EXTERNAL_HARNESS.md) runs the actual Codex
CLI over real MCP, with a natively loaded SQLRooms skill and no SQLRooms AI slice.
Both targets and the production browser share the app-local domain composition,
scenario fixtures, normalized snapshots, and behavioral checks. External execution
is not a model swap inside the embedded target.

Its deterministic regressions run in PR CI. The nightly workflow now runs a
separate external canary alongside Promptfoo using the same OpenRouter secret
and model variable. Both jobs retain their own workflow artifacts for 30 days;
local evidence stays local. See [CI configuration](EXTERNAL_HARNESS.md#ci-placement).
