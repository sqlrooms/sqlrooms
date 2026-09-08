import {
  getAiRunContextItems,
  getAiRunContextPrimaryItem,
  type AiRunContextItem,
} from '@sqlrooms/ai';

export const DOCUMENT_CONTEXT_KIND = 'document';

export function getPrimaryDocumentRunContextItem(
  runContext: unknown,
): AiRunContextItem | undefined {
  const primaryItem = getAiRunContextPrimaryItem(runContext);
  if (isDocumentRunContextItem(primaryItem)) return primaryItem;

  return getAiRunContextItems(runContext).find(isDocumentRunContextItem);
}

function isDocumentRunContextItem(
  item: AiRunContextItem | undefined,
): item is AiRunContextItem {
  return item?.kind === DOCUMENT_CONTEXT_KIND;
}
