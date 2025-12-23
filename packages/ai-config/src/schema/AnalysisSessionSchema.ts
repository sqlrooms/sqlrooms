import {z} from 'zod';
import {UIMessageSchema} from './UIMessageSchema';
import {
  needsV0_24_14Migration,
  migrateFromV0_24_14,
} from '../migration/AnalysisSession-v0.24.14';
import {
  needsV0_25_0Migration,
  migrateFromV0_25_0,
} from '../migration/AnalysisSession-v0.25.0';
import {
  needsV0_26_0Migration,
  migrateFromV0_26_0,
} from '../migration/AnalysisSession-v0.26.0';
import {
  needsV0_26_1Migration,
  migrateFromV0_26_1,
} from '../migration/AnalysisSession-v0.26.1';

export const ErrorMessageSchema = z.object({
  error: z.string(),
});
export type ErrorMessageSchema = z.infer<typeof ErrorMessageSchema>;

export const AnalysisResultSchema = z.object({
  id: z.string(), // allow any string ID to match UI message ID from AI SDK v5
  prompt: z.string(),
  errorMessage: ErrorMessageSchema.optional(),
  isCompleted: z.boolean(),
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;

export const AgentToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
  state: z.enum(['pending', 'success', 'error']),
});
export type AgentToolCallSchema = z.infer<typeof AgentToolCallSchema>;

export const AgentToolCallDataSchema = z.object({
  agentToolCalls: z.array(AgentToolCallSchema),
  finalOutput: z.string().optional(),
  timestamp: z.string(),
});
export type AgentToolCallDataSchema = z.infer<typeof AgentToolCallDataSchema>;

const AnalysisSessionBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  modelProvider: z.string(),
  model: z.string(),
  customModelName: z.string().optional(),
  baseUrl: z.string().optional(),
  analysisResults: z.array(AnalysisResultSchema),
  createdAt: z.coerce.date().optional(),
  uiMessages: z.array(UIMessageSchema),
  agentToolCallData: z.record(z.string(), AgentToolCallDataSchema).optional(),
  /** Revision counter that increments when messages are deleted, used to force useChat reset */
  messagesRevision: z.number().optional().default(0),
});

/**
 * Apply all migrations in sequence from oldest to newest.
 * This ensures that old data can be migrated through multiple versions.
 */
const migrateAnalysisSession = z.preprocess((data) => {
  let migrated = data;

  // Apply v0.24.14 migration (ollamaBaseUrl → baseUrl)
  if (needsV0_24_14Migration(migrated)) {
    migrated = migrateFromV0_24_14(migrated);
  }

  // Apply v0.25.0 migration (streamMessage format change)
  if (needsV0_25_0Migration(migrated)) {
    migrated = migrateFromV0_25_0(migrated);
  }

  // Apply v0.26.0 migration (add uiMessages)
  if (needsV0_26_0Migration(migrated)) {
    migrated = migrateFromV0_26_0(migrated);
  }

  // Apply v0.26.1 migration (toolAdditionalData → agentToolCallData)
  if (needsV0_26_1Migration(migrated)) {
    migrated = migrateFromV0_26_1(migrated);
  }

  return migrated;
}, AnalysisSessionBaseSchema);

export const AnalysisSessionSchema = migrateAnalysisSession;
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
