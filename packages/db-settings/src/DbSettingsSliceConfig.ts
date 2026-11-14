import {z} from 'zod';

/**
 * Field descriptor for engine-specific configuration.
 */
export const EngineConfigField = z.object({
  key: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  secret: z.boolean().optional(),
  required: z.boolean().optional(),
});
export type EngineConfigField = z.infer<typeof EngineConfigField>;

/**
 * Editor configuration for the DB settings slice. Connection definitions live in db.
 */
export const DbSettingsSliceConfig = z.object({
  supportedEngines: z.array(z.string()).default([]),
  engineConfigFields: z
    .record(z.string(), z.array(EngineConfigField))
    .default({}),
});
export type DbSettingsSliceConfig = z.infer<typeof DbSettingsSliceConfig>;
