import {z} from 'zod';
import {AiRunContextItemSchema} from './schema/ChatSessionSchema';

export const BlockAiRunContextItemSchema = AiRunContextItemSchema.extend({
  kind: z.literal('block'),
  blockDocumentId: z.string(),
  blockId: z.string(),
  blockType: z.string(),
  blockInstanceId: z.string().optional(),
  panelId: z.string().optional(),
});

export type BlockAiRunContextItem = z.infer<typeof BlockAiRunContextItemSchema>;

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
