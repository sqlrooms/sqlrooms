import {z} from 'zod';
import {StreamMessagePartSchema} from '@openassistant/core';

// Import individual migration functions
import {
  needsV0_20_0Migration,
  migrateFromV0_20_0,
} from './streamMessage-v0.20.0';
import {
  needsV0_24_14Migration,
  migrateFromV0_24_14,
} from './analysisSession-v0.24.14';
import {
  needsV0_25_0Migration,
  migrateFromV0_25_0,
} from './analysisSession-v0.25.0';

/**
 * Centralized migration function for stream messages
 * Applies all available migrations in the correct order
 */
export const migrateStreamMessage = z.preprocess(
  (data) => {
    let migratedData = data;

    // Migration from v0.20.0 (tool call format)
    if (needsV0_20_0Migration(migratedData)) {
      migratedData = migrateFromV0_20_0(migratedData);
    }

    // Future migrations can be added here:
    // if (needsV0_25_0Migration(migratedData)) {
    //   migratedData = migrateFromV0_25_0(migratedData);
    // }

    return migratedData;
  },
  z.object({
    parts: z.array(StreamMessagePartSchema).optional(),
  }),
);

/**
 * Centralized migration function for analysis sessions
 * Applies all available migrations in the correct order
 */
export const migrateAnalysisSession = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((data) => {
    let migratedData = data;

    // Migration from v0.24.14 (ollamaBaseUrl to baseUrl)
    if (needsV0_24_14Migration(migratedData)) {
      migratedData = migrateFromV0_24_14(migratedData);
    }

    // Migration from v0.25.0 (add toolAdditionalData field)
    if (needsV0_25_0Migration(migratedData)) {
      migratedData = migrateFromV0_25_0(migratedData);
    }

    // Future migrations can be added here:
    // if (needsV0_30_0Migration(migratedData)) {
    //   migratedData = migrateFromV0_30_0(migratedData);
    // }

    return migratedData;
  }, schema);

/**
 * Type for the migrated stream message
 */
export type MigratedStreamMessage = z.infer<typeof migrateStreamMessage>;

/**
 * Type for the migrated analysis session
 */
export type MigratedAnalysisSession<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof migrateAnalysisSession<T>>
>;
