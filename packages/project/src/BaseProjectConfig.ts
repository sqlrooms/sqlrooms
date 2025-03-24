import {z} from 'zod';

export const DEFAULT_PROJECT_TITLE = 'Untitled project';

export const BaseProjectConfig = z
  .object({
    title: z.string().default(DEFAULT_PROJECT_TITLE).describe('Project title.'),
    description: z.string().optional().describe('Project description.'),
  })
  .describe('Project configuration.');
export type BaseProjectConfig = z.infer<typeof BaseProjectConfig>;
