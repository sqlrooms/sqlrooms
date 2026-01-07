import {z} from 'zod';

// AI SDK v5 UIMessage schemas
const ProviderMetadataSchema = z.unknown();

const TextUIPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
  providerMetadata: ProviderMetadataSchema.optional(),
});

const ReasoningUIPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
  providerMetadata: ProviderMetadataSchema.optional(),
});

// Approval schema for tool approval workflow (AI SDK v6)
const ApprovalSchema = z.object({
  state: z.enum(['requested', 'approved', 'denied']),
  reason: z.string().optional(),
});

// tool-* parts (generic over tool name); model the state variants
const ToolUIPartBaseSchema = z.object({
  type: z.string().regex(/^tool-/),
  toolCallId: z.string(),
  title: z.string().optional(),
  providerExecuted: z.boolean().optional(),
});

const ToolUIPartInputStreamingSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('input-streaming'),
  input: z.unknown().optional(),
});

const ToolUIPartInputAvailableSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('input-available'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
});

// New in AI SDK v6: approval-requested state
const ToolUIPartApprovalRequestedSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('approval-requested'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

// New in AI SDK v6: approval-responded state
const ToolUIPartApprovalRespondedSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('approval-responded'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

const ToolUIPartOutputAvailableSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('output-available'),
  input: z.unknown(),
  output: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  preliminary: z.boolean().optional(),
  approval: ApprovalSchema.optional(),
});

const ToolUIPartOutputErrorSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('output-error'),
  input: z.unknown().optional(),
  rawInput: z.unknown().optional(),
  errorText: z.string(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema.optional(),
});

// New in AI SDK v6: output-denied state
const ToolUIPartOutputDeniedSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('output-denied'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

const ToolUIPartSchema = z.union([
  ToolUIPartInputStreamingSchema,
  ToolUIPartInputAvailableSchema,
  ToolUIPartApprovalRequestedSchema,
  ToolUIPartApprovalRespondedSchema,
  ToolUIPartOutputAvailableSchema,
  ToolUIPartOutputErrorSchema,
  ToolUIPartOutputDeniedSchema,
]);

export type ToolUIPart = z.infer<typeof ToolUIPartSchema>;

// dynamic-tool parts
const DynamicToolUIPartBaseSchema = z.object({
  type: z.literal('dynamic-tool'),
  toolName: z.string(),
  toolCallId: z.string(),
  title: z.string().optional(),
  providerExecuted: z.boolean().optional(),
});

const DynamicToolInputStreamingSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('input-streaming'),
  input: z.unknown().optional(),
});

const DynamicToolInputAvailableSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('input-available'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
});

// New in AI SDK v6: approval-requested state
const DynamicToolApprovalRequestedSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('approval-requested'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

// New in AI SDK v6: approval-responded state
const DynamicToolApprovalRespondedSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('approval-responded'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

const DynamicToolOutputAvailableSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('output-available'),
  input: z.unknown(),
  output: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  preliminary: z.boolean().optional(),
  approval: ApprovalSchema.optional(),
});

const DynamicToolOutputErrorSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('output-error'),
  input: z.unknown(),
  errorText: z.string(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema.optional(),
});

// New in AI SDK v6: output-denied state
const DynamicToolOutputDeniedSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('output-denied'),
  input: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  approval: ApprovalSchema,
});

const DynamicToolUIPartSchema = z.union([
  DynamicToolInputStreamingSchema,
  DynamicToolInputAvailableSchema,
  DynamicToolApprovalRequestedSchema,
  DynamicToolApprovalRespondedSchema,
  DynamicToolOutputAvailableSchema,
  DynamicToolOutputErrorSchema,
  DynamicToolOutputDeniedSchema,
]);

// Additional UIPart types from AI SDK v5
const StepStartUIPartSchema = z.object({
  type: z.literal('step-start'),
});

const SourceUrlUIPartSchema = z.object({
  type: z.literal('source-url'),
  sourceId: z.string(),
  url: z.string(),
  title: z.string().optional(),
  providerMetadata: ProviderMetadataSchema.optional(),
});

const SourceDocumentUIPartSchema = z.object({
  type: z.literal('source-document'),
  sourceId: z.string(),
  mediaType: z.string(),
  title: z.string(),
  filename: z.string().optional(),
  providerMetadata: ProviderMetadataSchema.optional(),
});

const FileUIPartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  filename: z.string().optional(),
  url: z.string().optional(),
  data: z.string().optional(),
  providerMetadata: ProviderMetadataSchema.optional(),
});

// Generic data part schema (for data-* types)
const DataUIPartSchema = z.object({
  type: z.string().regex(/^data-/),
  id: z.string().optional(),
  data: z.unknown(),
});

export const UIMessagePartSchema = z.union([
  TextUIPartSchema,
  ReasoningUIPartSchema,
  ToolUIPartSchema,
  DynamicToolUIPartSchema,
  StepStartUIPartSchema,
  SourceUrlUIPartSchema,
  SourceDocumentUIPartSchema,
  FileUIPartSchema,
  DataUIPartSchema,
]);

// Create a Zod schema for UIMessage (AI SDK v5)
export const UIMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  metadata: z.unknown().optional(),
  parts: z.array(UIMessagePartSchema),
});

// Export the type for UIMessagePart
export type UIMessagePart = z.infer<typeof UIMessagePartSchema>;
