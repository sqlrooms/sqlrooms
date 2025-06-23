import {z} from 'zod';

export const DuckDbSliceConfig = z.object({
  db: z
    .object({
      // nothing yet
    })
    .optional(), // TODO: remove this once we have a non-empty config
});
export type DuckDbSliceConfig = z.infer<typeof DuckDbSliceConfig>;

export function createDefaultDuckDbConfig(): DuckDbSliceConfig {
  return {
    db: {
      // nothing yet
    },
  };
}
