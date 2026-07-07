export type BlockAiTarget = {
  /** The block document id. */
  blockDocumentId: string;
  /** Block node id within the document. */
  blockId: string;
  /** Block type, such as chart, dashboard, html-app, or map. */
  blockType: string;
  /** Stateful instance id, such as dashboardId, appId, or mapId. */
  blockInstanceId?: string;
  /** Follow-up: a panel within a dashboard block. */
  panelId?: string;
  /** Display title or context subtitle. */
  title?: string;
};

const KNOWN_BLOCK_TYPE_TITLES: Record<string, string> = {
  chart: 'Chart',
  dashboard: 'Dashboard',
  'html-app': 'HTML app',
  map: 'Map',
  'data-table': 'Data table',
  'sql-query': 'SQL query',
  pivot: 'Pivot',
  python: 'Python',
  document: 'Document',
};

/**
 * Builds the stable context item id used when a block is added to AI context.
 *
 * The block document id, block id, and optional panel id are URL-encoded so
 * host-generated ids can safely contain separator characters.
 */
export function blockContextItemId(target: BlockAiTarget): string {
  const parts = [
    'block',
    encodeURIComponent(target.blockDocumentId),
    encodeURIComponent(target.blockId),
  ];
  if (target.panelId !== undefined) {
    parts.push(encodeURIComponent(target.panelId));
  }
  return parts.join(':');
}

/**
 * Parses a block AI context item id created by {@link blockContextItemId}.
 *
 * Returns `undefined` when the id is not a block context id, has the wrong
 * number of parts, or contains invalid URL-encoded components.
 */
export function parseBlockContextItemId(
  id: string,
): {blockDocumentId: string; blockId: string; panelId?: string} | undefined {
  const parts = id.split(':');
  if (parts[0] !== 'block' || (parts.length !== 3 && parts.length !== 4)) {
    return undefined;
  }
  const [, encodedBlockDocumentId, encodedBlockId, encodedPanelId] = parts;
  if (!encodedBlockDocumentId || !encodedBlockId) {
    return undefined;
  }

  try {
    const blockDocumentId = decodeURIComponent(encodedBlockDocumentId);
    const blockId = decodeURIComponent(encodedBlockId);
    const panelId =
      encodedPanelId !== undefined
        ? decodeURIComponent(encodedPanelId)
        : undefined;
    return panelId === undefined
      ? {blockDocumentId, blockId}
      : {blockDocumentId, blockId, panelId};
  } catch {
    return undefined;
  }
}

/**
 * Returns a display title for a block type, preferring a non-empty explicit title.
 *
 * Known block types use product-friendly labels, unknown types are title-cased,
 * and an empty block type falls back to "Block".
 */
export function defaultBlockTitle(blockType: string, title?: string): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle;

  const knownTitle = KNOWN_BLOCK_TYPE_TITLES[blockType];
  if (knownTitle) return knownTitle;

  const words = blockType
    .split(/[-_\s]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length === 0) return 'Block';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
