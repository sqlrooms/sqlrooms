# AI Skills Example

A browser-only SQLRooms example demonstrating the **file-based skills** system: an AI agent that discovers and executes skills defined as Markdown documents, backed by real in-browser DuckDB queries, with chart capabilities.

## Architecture

```
User chat
  └── AI agent (discoverSkill + runSkill tools)
        └── runSkill (orchestrator sub-agent)
              ├── runSkillAgent (leaf sub-agent)
              │     └── executeApi (data.query / createChart)
              ├── loadSkill (read skill instructions)
              └── readFile (read reference docs)
```

The skills engine uses a two-level sub-agent pattern:

1. **Orchestrator** — plans which skills to run and in what order, delegates execution to leaf agents.
2. **Leaf** — follows the skill's step-by-step instructions, calling `executeApi` to run DuckDB queries and generate charts.

Skills are defined as Markdown files (`SKILL.md`) in the `skills/` directory, bundled at build time into TypeScript, and served via a `BundledSkillStorage`.

## Bundled Skills

| Skill | Description |
|-------|-------------|
| `chart` | Create Vega-Lite chart visualizations from SQL query results |

## Running

```bash
# From the sqlrooms workspace root:
pnpm build           # Build workspace packages first
pnpm dev ai-skills-example

# Or from this directory:
npm install
npm run dev
```

## How Skills Are Authored

Each skill is a directory under `skills/` containing:

- `SKILL.md` — the main instruction document (required). The H1 heading becomes the skill name; the first paragraph becomes the description.
- `skill.yaml` — optional manifest with explicit id/name/description/version.
- `references/*.md` — optional supporting documents the skill can load at runtime via `readFile`.

At build time, `scripts/generate-skills.ts` walks the `skills/` directory, parses each skill via `loadSkillFromFiles` from `@sqlrooms/ai`, and emits `src/skills/bundledSkills.ts`.

## Key Files

- `skills/` — Markdown skill definitions (source of truth)
- `scripts/generate-skills.ts` — Build-time skill bundler
- `src/skills/skillStorage.ts` — `BundledSkillStorage` implementing the `SkillStorage` interface
- `src/skills/runSkillTool.ts` — Orchestrator/leaf sub-agent pattern
- `src/skills/executeApiTool.ts` — Browser-side command execution (DuckDB, chart)
- `src/skills/executeApiToolRenderer.tsx` — Renders `createChart` output as a Vega-Lite chart (`@sqlrooms/vega`), hoisted to the conversation via `hoistedRenderers` in `MainView`
- `src/store.ts` — Zustand store wiring all slices together

## Adding a New Skill

1. Create `skills/<skill-id>/SKILL.md` with instructions.
2. Run `npm run generate-skills` to regenerate the bundle.
3. The skill automatically appears in `discoverSkill` results.
