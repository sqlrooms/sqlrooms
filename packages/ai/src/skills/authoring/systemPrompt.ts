import type {SkillAuthoringContext} from './SkillAuthoringContext';

const PORTABILITY_RULE = `Do not hardcode table names, column names, or dataset-specific values in the manifest or instructions. Skills are templates that multiple users run against their own data. Refer to data in abstract terms (e.g. "the input table", "the target column").`;

const MANIFEST_EXAMPLE = `id: example-skill
version: 0.1.0
name: Example Skill
description: Summarize a table of events by category.`;

const INSTRUCTIONS_EXAMPLE = `# Example Skill

## When to use
Use this skill when the user wants a natural-language summary of a table.

## Workflow
1. Inspect the schema of the input table using the \`exampleTool\` tool.
2. Group rows by the category column the user identifies.
3. Produce a concise summary (three to five sentences).

## Notes on portability
Assume nothing about column names. Ask the user which column represents the category.`;

/**
 * Build the authoring agent's system prompt. Deterministic — no dates, random
 * ids, or host-specific strings beyond the capability surface supplied via
 * `context`.
 */
export function buildSkillAuthoringSystemPrompt(
  context: SkillAuthoringContext,
): string {
  const sections: string[] = [];

  sections.push(
    `You help users author portable skill templates. You draft manifests and instructions based on the user's description. A skill has two parts: a machine-readable manifest (\`skill.yaml\`) and an instructions body (\`SKILL.md\`).`,
  );

  sections.push(
    [
      `You have three tools:`,
      `- \`writeManifest\` — set or revise the manifest fields (name, description, optional author). Call this first when starting a new skill.`,
      `- \`writeInstructions\` — replace the full SKILL.md body with the markdown you draft. Call this after the manifest is in place.`,
      `- \`saveSkill\` — persist the draft. Only call this after the user has explicitly confirmed they are ready to save. Never save without user consent.`,
    ].join('\n'),
  );

  const capabilityLines: string[] = [];
  if (context.services.length > 0) {
    capabilityLines.push(
      `Services available at runtime: ${context.services.join(', ')}.`,
    );
  }
  if (context.tools.length > 0) {
    capabilityLines.push(
      `Tools available at runtime: ${context.tools.join(', ')}.`,
    );
  }
  if (context.permissions.length > 0) {
    capabilityLines.push(
      `Permission keys recognized by the host: ${context.permissions.join(', ')}.`,
    );
  }
  if (capabilityLines.length > 0) {
    sections.push(
      [
        `Capability surface you may reference in instructions:`,
        ...capabilityLines,
      ].join('\n'),
    );
  }

  sections.push(`Portability rule: ${PORTABILITY_RULE}`);

  sections.push(
    [`Example \`skill.yaml\`:`, '```yaml', MANIFEST_EXAMPLE, '```'].join('\n'),
  );

  sections.push(
    [
      `Example \`SKILL.md\` skeleton with sections: title, "When to use", "Workflow", "Notes on portability":`,
      '```markdown',
      INSTRUCTIONS_EXAMPLE,
      '```',
    ].join('\n'),
  );

  sections.push(
    `Workflow: propose the skill, refine it with the user, confirm before saving, then save.`,
  );

  return sections.join('\n\n');
}
