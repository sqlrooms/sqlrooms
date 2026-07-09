import {z} from 'zod';
import {AiRunContextItemSchema} from './schema/ChatSessionSchema';

/**
 * AI run context item schema for a selected block inside a block document.
 *
 * The item captures the document id, document block id, block type, optional
 * backing instance id, and optional panel id so agents can route edits to the
 * exact surface the user invoked.
 */
export const BlockAiRunContextItemSchema = AiRunContextItemSchema.extend({
  kind: z.literal('block'),
  blockDocumentId: z.string(),
  blockId: z.string(),
  blockType: z.string(),
  blockInstanceId: z.string().optional(),
  panelId: z.string().optional(),
});

/**
 * Context item describing a block-scoped AI request.
 *
 * Use this when a run starts from an individual worksheet/document block rather
 * than from the whole artifact.
 */
export type BlockAiRunContextItem = z.infer<typeof BlockAiRunContextItemSchema>;

/**
 * Create and validate a block-scoped AI run context item.
 *
 * The returned item is parsed through {@link BlockAiRunContextItemSchema} so
 * omitted optional fields are normalized consistently with stored chat context.
 */
export function createBlockContextItem(fields: {
  id: string;
  blockDocumentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId?: string;
  panelId?: string;
  title: string;
  subtitle?: string;
}): BlockAiRunContextItem {
  const item = {
    kind: 'block',
    id: fields.id,
    title: fields.title,
    type: fields.blockType,
    ...(fields.subtitle !== undefined ? {subtitle: fields.subtitle} : {}),
    blockDocumentId: fields.blockDocumentId,
    blockId: fields.blockId,
    blockType: fields.blockType,
    ...(fields.blockInstanceId !== undefined
      ? {blockInstanceId: fields.blockInstanceId}
      : {}),
    ...(fields.panelId !== undefined ? {panelId: fields.panelId} : {}),
  };

  return BlockAiRunContextItemSchema.parse(item);
}
