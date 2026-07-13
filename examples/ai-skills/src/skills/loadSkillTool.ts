import {z} from 'zod';
import {tool} from 'ai';
import type {SkillStorage, SkillRecord} from '@sqlrooms/ai';

/**
 * Tool that loads a skill's full instructions into the agent's context.
 * Used by the orchestrator/leaf to read skill documentation before execution.
 */
export function createLoadSkillTool(
  storage: SkillStorage,
  templateVars: Record<string, string> = {},
) {
  return tool({
    description:
      "Load another skill's full instructions into context. Pass the skill id (slug).",
    inputSchema: z.object({
      skillId: z.string().describe('The skill ID (slug) to load'),
    }),
    execute: async ({skillId}) => {
      const ref = await storage.resolveSkillId(skillId);
      if (!ref) {
        return {success: false, error: `Skill not found: ${skillId}`};
      }
      let record: SkillRecord;
      try {
        record = await storage.readSkill(ref);
      } catch {
        return {success: false, error: `Failed to read skill: ${skillId}`};
      }
      let instructions = record.instructions;
      for (const [key, val] of Object.entries(templateVars)) {
        instructions = instructions.replaceAll(`{{${key}}}`, val);
      }
      return {success: true, skillId, instructions};
    },
  });
}
