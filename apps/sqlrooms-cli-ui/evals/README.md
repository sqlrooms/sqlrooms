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

The model revision, temperature, maximum steps, scenario/profile versions, and
three repetitions are pinned in `promptfooconfig.yaml`. Promptfoo stores its
SQLite database beneath `PROMPTFOO_CONFIG_DIR` (or its normal user config
directory). The CI job uploads that database plus JSON and compact Markdown
summaries for 30 days. Provider/transport errors are tagged separately from
behavioral check failures in provider metadata.

The scripted-model test in Jest is wiring coverage only. It proves the real
transport/tool/state path is connected without credentials or network access;
it is not evidence of production-model behavior.
