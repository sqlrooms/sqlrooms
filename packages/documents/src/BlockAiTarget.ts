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

export function parseBlockContextItemId(
  id: string,
): {blockDocumentId: string; blockId: string; panelId?: string} | undefined {
  const parts = id.split(':');
  if (parts[0] !== 'block' || (parts.length !== 3 && parts.length !== 4)) {
    return undefined;
  }

  try {
    const blockDocumentId = decodeURIComponent(parts[1]);
    const blockId = decodeURIComponent(parts[2]);
    const panelId =
      parts.length === 4 ? decodeURIComponent(parts[3]) : undefined;
    return panelId === undefined
      ? {blockDocumentId, blockId}
      : {blockDocumentId, blockId, panelId};
  } catch {
    return undefined;
  }
}

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
