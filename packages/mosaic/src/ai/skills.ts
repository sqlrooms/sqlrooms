/**
 * Minimal skill record shape consumed by Mosaic agents.
 *
 * This intentionally stays structural so hosts can pass `@sqlrooms/ai`
 * `SkillStorage` implementations without making Mosaic depend on that package.
 */
export type AgentSkillStorage = {
  resolveSkillId(id: string): Promise<{rootId: string; id: string} | null>;
  readSkill(ref: {rootId: string; id: string}): Promise<{
    ref: {rootId: string; id: string};
    manifest: {name: string; description: string};
    instructions: string;
  }>;
};

/**
 * Skill selection metadata included in agent results for traceability.
 */
export type AppliedAgentSkill = {
  id: string;
  rootId: string;
};

/**
 * Resolve skill ids against a storage root and render them as an agent prompt
 * section. Missing skills are ignored so package agents keep working when a
 * host does not provide bundled or user skills.
 */
export async function buildAgentSkillsInstructions({
  storage,
  skillIds,
  heading,
}: {
  storage?: AgentSkillStorage;
  skillIds: ReadonlyArray<string>;
  heading: string;
}): Promise<{
  instructions?: string;
  appliedSkills: AppliedAgentSkill[];
}> {
  if (!storage || skillIds.length === 0) {
    return {appliedSkills: []};
  }

  const sections: string[] = [];
  const appliedSkills: AppliedAgentSkill[] = [];

  for (const skillId of skillIds) {
    const ref = await storage.resolveSkillId(skillId);
    if (!ref) continue;
    const skill = await storage.readSkill(ref);
    appliedSkills.push({id: skill.ref.id, rootId: skill.ref.rootId});
    sections.push(
      `### ${skill.manifest.name}\n` +
        `Skill: ${skill.ref.id}\n` +
        `Root: ${skill.ref.rootId}\n` +
        `Purpose: ${skill.manifest.description}\n\n` +
        skill.instructions.trim(),
    );
  }

  if (sections.length === 0) {
    return {appliedSkills};
  }

  return {
    appliedSkills,
    instructions: `## ${heading}\n\n${sections.join('\n\n')}`,
  };
}
