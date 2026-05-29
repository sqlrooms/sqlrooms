import {
  getAiRunContextPrimaryItem,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai';
import {findTableInSchemaTrees, makeQualifiedTableName} from '@sqlrooms/duckdb';
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
    'Current artifact context:',
    `- Primary target: ${artifactType} "${mainItem?.title}" (id: ${mainItem?.id}). Pass this id as artifactId when using a tool that should modify it.`,
    ...additionalItems.map(
      (item) =>
        `- Additional reference context: ${item.type ?? 'artifact'} "${item.title}" (id: ${item.id}).`,
    ),
    '- Additional context items are reference-only by default; tools will not implicitly target them. Use set_primary_context_artifact before modifying a reference artifact.',
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
  const {schemaTrees} = state.db;

  const tableDetails = tableItems.map((item) => {
    const tableObj = findTableInSchemaTrees(
      schemaTrees,
      item.id,
      makeQualifiedTableName,
    );

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

  const sections: string[] = [
    ...formatArtifactContextInstructions(artifactItems, runContext),
    ...formatTableContextInstructions(tableItems, store),
  ];

  return sections.join('\n');
}
