import {z} from 'zod';

export const SqlEditorConfig = z.object({
  queries: z.array(
    z.object({
      id: z.string().describe('Query identifier.'),
      name: z.string().describe('Query name.'),
      query: z.string().describe('SQL query to execute.'),
    }),
  ),
  selectedQueryId: z
    .string()
    .describe('The id of the currently selected query.'),
});
export type SqlEditorConfig = z.infer<typeof SqlEditorConfig>;
