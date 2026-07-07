import {
  AiRunContextItemSchema,
  type AiRunContextItem,
} from './schema/ChatSessionSchema';

export function createBlockContextItem(fields: {
  id: string;
  blockDocumentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId?: string;
  panelId?: string;
  title: string;
  subtitle?: string;
}): AiRunContextItem {
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

  return AiRunContextItemSchema.parse(item);
}
