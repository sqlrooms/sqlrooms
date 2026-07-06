# SQLRooms Skills Pattern

Skills are reusable instruction sets that shape agent judgment without becoming
new mutation paths. Agents still execute through typed tools, commands, stores,
and adapters.

## Ownership

Put a skill next to the owner of the judgment it encodes:

- Package skills describe reusable package capabilities and constraints.
- App skills describe product routing, host defaults, and artifact policy.
- User and workspace skills describe local preferences and recurring workflows.

For dashboards, `@sqlrooms/mosaic` owns reusable dashboard guidance such as
chart selection and runtime constraints. `apps/sqlrooms-cli-ui` owns worksheet
and artifact routing policy.

## Priority

Compose skill roots in this order:

```text
workspace skills
user skills
app bundled skills
package bundled skills
```

Higher-priority roots can intentionally shadow lower-priority skill ids.
Preserve root ids in traces so selected guidance remains inspectable.

## Agent Use

Agents should:

- select a small relevant skill set for the current request;
- append selected skill text to the agent prompt;
- keep tool schemas, command ids, targeting rules, and result shapes in code;
- record selected `{id, rootId}` pairs in metadata or devtools traces;
- keep working when no skills are available.

Skills must not grant tools, bypass command schemas, or mutate state directly.

## Skill Cards

Before adding a new skill, write a short card:

- Skill
- Owner
- Purpose
- Runtime tools allowed
- Commands/actions it may invoke
- State it may mutate
- Expected traces
- Why this belongs in a skill
- Why this is safe to override

Use concrete, reviewable skills before building broader ranking or authoring UI.
