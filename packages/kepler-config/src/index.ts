/**
 * {@include ../README.md}
 * @packageDocumentation
 */

import z from 'zod';

export const KeplerMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastOpenedAt: z.number().optional(),
  config: z
    .object({
      version: z.literal('v1'),
      config: z.object({
        visState: z.object({}).passthrough(),
        mapState: z.object({}).passthrough(),
        mapStyle: z.object({}).passthrough(),
        uiState: z.object({}).passthrough(),
      }),
    })
    .optional(),
});
export type KeplerMapSchema = z.infer<typeof KeplerMapSchema>;

export const KeplerSliceConfig = z.preprocess(
  (val) => {
    // Migration: initialize openTabs from maps if not set (for previously saved projects)
    if (
      val &&
      typeof val === 'object' &&
      'maps' in val &&
      Array.isArray(val.maps) &&
      !('openTabs' in val)
    ) {
      return {
        ...val,
        openTabs: val.maps.map((m: {id: string}) => m.id),
      };
    }
    return val;
  },
  z.object({
    currentMapId: z.string(),
    maps: z.array(KeplerMapSchema),
    /** IDs of maps that are currently open (visible in tab strip). */
    openTabs: z.array(z.string()),
  }),
);
export type KeplerSliceConfig = z.infer<typeof KeplerSliceConfig>;
