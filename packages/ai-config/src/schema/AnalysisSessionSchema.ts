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

export const AiRunContextItemSchema = z
  .object({
    kind: z.string(),
    id: z.string(),
    title: z.string(),
    type: z.string().optional(),
    subtitle: z.string().optional(),
  })
  .passthrough();
export type AiRunContextItem = z.infer<typeof AiRunContextItemSchema>;

const AiRunContextBaseSchema = z
  .object({
    items: z.array(AiRunContextItemSchema),
    primaryItemId: z.string().optional(),
    capturedAt: z.number(),
  })
  .passthrough();

export const AiRunContextSchema = z.preprocess((data) => {
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'kind' in data &&
    'id' in data &&
    'title' in data &&
    !('items' in data)
  ) {
    const legacyContext = data as {
      kind: unknown;
      id: unknown;
      title: unknown;
      type?: unknown;
      capturedAt?: unknown;
    };
    const {capturedAt, ...item} = legacyContext;
    return {
      items: [item],
      capturedAt: typeof capturedAt === 'number' ? capturedAt : 0,
    };
  }
  return data;
}, AiRunContextBaseSchema);
export type AiRunContext = z.infer<typeof AiRunContextSchema>;

export function getAiRunContextItems(
  runContext: AiRunContext | unknown,
): AiRunContextItem[] {
  if (!runContext || typeof runContext !== 'object') return [];

  if ('items' in runContext && Array.isArray(runContext.items)) {
    return runContext.items
      .map((item) => AiRunContextItemSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);
  }

  const legacyResult = AiRunContextItemSchema.safeParse(runContext);
  return legacyResult.success ? [legacyResult.data] : [];
}

export function getAiRunContextPrimaryItem(
  runContext: AiRunContext | unknown,
): AiRunContextItem | undefined {
  const items = getAiRunContextItems(runContext);
  if (items.length === 0) return undefined;

  const primaryItemId =
    runContext &&
    typeof runContext === 'object' &&
    'primaryItemId' in runContext &&
    typeof runContext.primaryItemId === 'string'
      ? runContext.primaryItemId
      : undefined;

  return primaryItemId
    ? items.find((item) => item.id === primaryItemId) ?? items[0]
    : items[0];
}

export function setAiRunContextPrimaryItem(
  runContext: AiRunContext | unknown,
  item: AiRunContextItem,
): AiRunContext {
  const parsedContext = AiRunContextSchema.safeParse(runContext);
  const baseContext = parsedContext.success ? parsedContext.data : undefined;
  const existingItems = getAiRunContextItems(runContext).filter(
    (existing) => !(existing.kind === item.kind && existing.id === item.id),
  );

  return {
    ...(baseContext ?? {}),
    items: [item, ...existingItems],
    primaryItemId: item.id,
    capturedAt: baseContext?.capturedAt ?? Date.now(),
  };
}

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
  /** Revision counter that increments when messages are deleted, used to force useChat reset */
  messagesRevision: z.number().optional().default(0),
  /** Per-session analysis prompt text */
  prompt: z.string().default(''),
  /** Per-session flag indicating if analysis is running */
  isRunning: z.boolean().default(false),
  /** Last time the session was opened/selected (epoch ms) */
  lastOpenedAt: z.number().optional(),
  /** Context captured when the current run started. */
  runContext: AiRunContextSchema.optional(),
  /** Persisted sub-agent tool call trees, keyed by parent toolCallId */
  agentProgress: z.record(z.string(), z.array(z.unknown())).optional(),
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

  // Apply v0.26.0 migration (add uiMessages and toolAdditionalData)
  if (needsV0_26_0Migration(migrated)) {
    migrated = migrateFromV0_26_0(migrated);
  }

  return migrated;
}, AnalysisSessionBaseSchema);

export const AnalysisSessionSchema = migrateAnalysisSession;
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
