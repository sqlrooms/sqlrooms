import {
  getAiRunContextPrimaryItem,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai';
import {blockDocumentNodeToBlock} from '@sqlrooms/documents';
import type {RoomState} from '../store-types';
import type {StoreApi} from 'zustand';

function formatArtifactContextInstructions(
  artifactItems: AiRunContextItem[],
  runContext: AiRunContext | undefined,
): string[] {
  if (artifactItems.length === 0) {
    return [];
  }

  // Use primary item only if it's an artifact, otherwise use first artifact
  const primaryItem = getAiRunContextPrimaryItem(runContext);

  const [firstArtifact] = artifactItems;

  const mainItem =
    primaryItem?.kind === 'artifact' ? primaryItem : firstArtifact;

  const additionalItems = artifactItems.filter(
    (item) => item.id !== mainItem.id,
  );

  const artifactType = mainItem?.type ?? 'artifact';

  return [
    `Current artifact: ${artifactType} "${mainItem?.title}" (id: ${mainItem?.id}). Tools should target this artifact by default unless the user explicitly asks otherwise.`,
    ...(additionalItems.length > 0 ? ['Additional artifact context:'] : []),
    ...additionalItems.map(
      (item) =>
        `- ${item.type ?? 'artifact'} "${item.title}" (id: ${item.id}).`,
    ),
    ...(additionalItems.length > 0
      ? [
          '- Additional artifact context items are reference-only by default; tools will not implicitly target them. Use set_primary_context_artifact before modifying a reference artifact.',
        ]
      : []),
  ];
}

function formatTableContextInstructions(
  tableItems: AiRunContextItem[],
  store: StoreApi<RoomState>,
): string[] {
  if (tableItems.length === 0) {
    return [];
  }

  const state = store.getState();

  const tableDetails = tableItems.map((item) => {
    const tableObj = state.db.findTable(item.id);

    const columnCount = tableObj?.columns.length ?? 0;
    const rowCount = tableObj?.rowCount;

    const typeLabel = item.type === 'view' ? 'view' : 'table';
    const rowInfo =
      rowCount !== undefined ? `, ${rowCount.toLocaleString()} rows` : '';
    return `  - ${item.title} (${typeLabel}${item.subtitle ? ` in ${item.subtitle}` : ''}, ${columnCount} columns${rowInfo}) → qualified name: ${item.id}`;
  });

  return [
    '',
    `Current table context (${tableItems.length} ${tableItems.length === 1 ? 'table' : 'tables'}):`,
    ...tableDetails,
    '- Use the qualified names shown above when querying these tables.',
  ];
}

function stringField(item: AiRunContextItem, field: string): string | undefined {
  const value = (item as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function formatBlockContextInstructions(
  blockItems: AiRunContextItem[],
  store: StoreApi<RoomState>,
): string[] {
  if (blockItems.length === 0) {
    return [];
  }

  const state = store.getState();
  const details = blockItems.map((item) => {
    const blockDocumentId = stringField(item, 'blockDocumentId');
    const blockId = stringField(item, 'blockId');
    const blockType = stringField(item, 'blockType') ?? item.type ?? 'block';
    const blockInstanceId = stringField(item, 'blockInstanceId');
    const artifactTitle = blockDocumentId
      ? state.artifacts.config.artifactsById[blockDocumentId]?.title
      : undefined;
    const blockDocument = blockDocumentId
      ? state.blockDocuments.config.artifacts[blockDocumentId]
      : undefined;
    const blockExists =
      Boolean(blockId) &&
      Boolean(
        blockDocument?.content.content.some((node) => {
          const block = blockDocumentNodeToBlock(node);
          return block?.id === blockId;
        }),
      );

    if (!blockDocument || !blockExists) {
      return `Target block is unresolved or deleted: ${blockType} block "${item.title}" (blockId: ${blockId ?? item.id})${artifactTitle ? ` in "${artifactTitle}"` : ''}. Ask the user to choose an existing block before modifying it.`;
    }

    return `Target block: ${blockType} block "${item.title}" (blockId: ${blockId}, instanceId: ${blockInstanceId ?? 'none'}) in "${artifactTitle ?? blockDocumentId}". When the user asks to modify a block, operate on THIS block. For a dashboard block, delegate to the dashboard agent with dashboardId = the block instance id; for an HTML app block, delegate to the HTML app agent with appId = the block instance id; for a map block, use the map tool with mapId = the block instance id; for a chart block, update the chart in place.`;
  });

  return ['', 'Current block edit target:', ...details];
}

export function formatRunContextInstructions(
  runContext: AiRunContext | undefined,
  store: StoreApi<RoomState>,
): string {
  if (!runContext) {
    return '';
  }

  const {items} = runContext;

  const artifactItems = items.filter((item) => item.kind === 'artifact');
  const tableItems = items.filter((item) => item.kind === 'table');
  const blockItems = items.filter((item) => item.kind === 'block');

  const sections: string[] = [
    ...formatArtifactContextInstructions(artifactItems, runContext),
    ...formatTableContextInstructions(tableItems, store),
    ...formatBlockContextInstructions(blockItems, store),
  ];

  return sections.join('\n');
}
