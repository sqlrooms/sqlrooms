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

// tool-* parts (generic over tool name); model the state variants
const ToolUIPartBaseSchema = z.object({
  type: z.string().regex(/^tool-/),
  toolCallId: z.string(),
});

const ToolUIPartInputStreamingSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('input-streaming'),
  input: z.unknown().optional(),
  providerExecuted: z.boolean().optional(),
});

const ToolUIPartInputAvailableSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('input-available'),
  input: z.unknown(),
  providerExecuted: z.boolean().optional(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
});

const ToolUIPartOutputAvailableSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('output-available'),
  input: z.unknown(),
  output: z.unknown(),
  providerExecuted: z.boolean().optional(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  preliminary: z.boolean().optional(),
});

const ToolUIPartOutputErrorSchema = ToolUIPartBaseSchema.extend({
  state: z.literal('output-error'),
  input: z.unknown().optional(),
  rawInput: z.unknown().optional(),
  errorText: z.string(),
  providerExecuted: z.boolean().optional(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
});

const ToolUIPartSchema = z.union([
  ToolUIPartInputStreamingSchema,
  ToolUIPartInputAvailableSchema,
  ToolUIPartOutputAvailableSchema,
  ToolUIPartOutputErrorSchema,
]);

// dynamic-tool parts
const DynamicToolUIPartBaseSchema = z.object({
  type: z.literal('dynamic-tool'),
  toolName: z.string(),
  toolCallId: z.string(),
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

const DynamicToolOutputAvailableSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('output-available'),
  input: z.unknown(),
  output: z.unknown(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
  preliminary: z.boolean().optional(),
});

const DynamicToolOutputErrorSchema = DynamicToolUIPartBaseSchema.extend({
  state: z.literal('output-error'),
  input: z.unknown(),
  errorText: z.string(),
  callProviderMetadata: ProviderMetadataSchema.optional(),
});

const DynamicToolUIPartSchema = z.union([
  DynamicToolInputStreamingSchema,
  DynamicToolInputAvailableSchema,
  DynamicToolOutputAvailableSchema,
  DynamicToolOutputErrorSchema,
]);

const UIMessagePartSchema = z.union([
  TextUIPartSchema,
  ReasoningUIPartSchema,
  ToolUIPartSchema,
  DynamicToolUIPartSchema,
]);

// Create a Zod schema for UIMessage (AI SDK v5)
export const UIMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  metadata: z.unknown().optional(),
  parts: z.array(UIMessagePartSchema),
});
