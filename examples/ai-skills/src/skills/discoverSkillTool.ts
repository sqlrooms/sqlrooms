import {z} from 'zod';
import {tool} from 'ai';
import type {SkillStorage} from '@sqlrooms/ai';

/**
 * Tool that lists all available skills from the storage so the top-level
 * agent knows what skills exist and can pick the right one.
 */
export function createDiscoverSkillTool(storage: SkillStorage) {
  return tool({
    description:
      'List all available skills. Returns skill IDs, names, and descriptions ' +
      'so you can decide which skill to run for a given user request.',
    inputSchema: z.object({
      reasoning: z.string().describe('Why you are discovering skills'),
    }),
    execute: async () => {
      const listings = await storage.listSkills();
      return {
        skills: listings.map((l) => ({
          id: l.ref.id,
          name: l.manifest.name,
          description: l.manifest.description,
        })),
      };
    },
  });
}
