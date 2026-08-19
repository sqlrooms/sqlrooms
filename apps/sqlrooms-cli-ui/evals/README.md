# SQLRooms production-model behavioral evals

The nightly suite runs the production `worksheet-charts-maps@1` CLI profile
through the in-process target. Promptfoo schedules and retains runs; SQLRooms'
deterministic state and policy oracles decide pass/fail. No LLM grader is used,
so application token usage remains separate from the zero grader usage recorded
in the evidence envelope.

## Run locally

Build workspace packages, set an OpenRouter key, and run either the whole suite
or one scenario. `evals:nightly` first creates the Node provider bundle used by
Promptfoo, avoiding browser-only CSS/module imports from application barrels:

```sh
pnpm build
export OPENROUTER_API_KEY=...
pnpm evals:nightly
pnpm evals:nightly --filter-pattern 'worksheet.create-chart-map'
```

The model revision, temperature, maximum steps, scenario/profile versions, and
three repetitions are pinned in `promptfooconfig.yaml`. Promptfoo stores its
SQLite database beneath `PROMPTFOO_CONFIG_DIR` (or its normal user config
directory). The CI job uploads that database plus JSON and compact Markdown
summaries for 30 days. Provider/transport errors are tagged separately from
behavioral oracle failures in provider metadata.

The scripted-model test in Jest is wiring coverage only. It proves the real
transport/tool/state path is connected without credentials or network access;
it is not evidence of production-model behavior.
