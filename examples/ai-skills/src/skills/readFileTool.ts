import {z} from 'zod';
import {tool} from 'ai';
import type {SkillStorage} from '@sqlrooms/ai';

/**
 * Tool that reads a reference document from a skill's directory.
 * Skill instructions reference docs via relative paths like
 * "references/trip-time-split.md".
 */
export function createReadFileTool(storage: SkillStorage) {
  return tool({
    description:
      'Read a reference document from a skill directory. Pass the skill id and file path (e.g. "references/trip-time-split.md").',
    inputSchema: z.object({
      skillId: z.string().describe('The skill ID whose file to read'),
      filePath: z.string().describe('Relative path to the file within the skill directory'),
    }),
    execute: async ({skillId, filePath}) => {
      const ref = await storage.resolveSkillId(skillId);
      if (!ref) {
        return {success: false, error: `Skill not found: ${skillId}`};
      }
      try {
        const record = await storage.readSkill(ref);
        const match = record.extraFiles.find(
          (f) => f.relativePath === filePath || f.relativePath === `references/${filePath}`,
        );
        if (!match) {
          return {
            success: false,
            error: `File not found: ${filePath}. Available: ${record.extraFiles.map((f) => f.relativePath).join(', ') || 'none'}`,
          };
        }
        return {success: true, content: match.content};
      } catch {
        return {success: false, error: `Failed to read skill files: ${skillId}`};
      }
    },
  });
}
