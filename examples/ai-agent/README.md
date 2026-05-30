# SQLRooms AI Agent demo app

A simple example demonstrating a single AI agent (weather lookup) using the core AI module.

For a more advanced example with nested sub-agents and approval flows, see [examples/ai-subagents](../ai-subagents/).

[More about SQLRooms examples](https://sqlrooms.org/examples/)

# Running locally

Requires `OPENAI_API_KEY` in your environment (set in the in-app settings
panel).

    pnpm install
    pnpm build
    pnpm dev ai-agent-example

## Skills

This example demonstrates the three extension points of the skills subsystem
in `@sqlrooms/ai`:

### Storage

`src/skills/InMemorySkillStorage.ts` implements `SkillStorage` against two
in-memory roots:

- `built-in` — read-only, seeded from `src/skills/seedSkills.ts`.
- `default` — writable, where newly authored skills land.

Seeds are round-tripped through `parseSkillManifest` + `loadSkillFromFiles`
at construction time. If any seed's YAML drifts out of schema, the app
crashes on load — the intentional failure mode.

### Authoring

Click **New skill** in the header. The dialog mounts `SkillAuthoringPanel`
from `@sqlrooms/ai` with a per-open draft store (`createSkillDraftStore`)
and a fresh `SkillAuthoringAgent`. The agent has three tools: `writeManifest`,
`writeInstructions`, `saveSkill`. On save, the host hands a `SkillRef` back
to the agent and closes the dialog.

See `src/components/SkillsButton.tsx`.

### Runtime

`src/skills/runSkillTool.ts` is the minimal runtime: resolve `skillId` → read
the record → spin up a fresh `ToolLoopAgent` seeded with the skill's `SKILL.md`
as its instructions and `querySQL` as its only tool → stream it via
`streamSubAgent` so tool calls surface in the parent's activity log.

The runtime is deliberately minimal: no template variables, no cross-skill
dependencies, no auto-visualization step. A real host would extend this with
whatever orchestration it needs. `querySQL` itself is simulated (returns a
canned 3-row result) because the example ships without a real database — in
a real host, replace it with a tool that executes against a live DuckDB
connector.
