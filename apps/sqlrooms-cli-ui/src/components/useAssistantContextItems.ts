import {
  getAiRunContextItems,
  getVisibleSessionContextItemIds,
  type ContextSelectorItem,
} from '@sqlrooms/ai';
import {
  getTableDisplayName,
  getTableIdentity,
  parseTableIdentity,
  type DataTable,
  type TableIdentity,
} from '@sqlrooms/duckdb';
import {
  blockContextItemId,
  blockDocumentNodeId,
  blockDocumentNodeToBlock,
  defaultBlockTitle,
  parseBlockContextItemId,
  type BlockAiTarget,
} from '@sqlrooms/documents';
import {useMemo} from 'react';
import type {ArtifactMetadata} from '@sqlrooms/artifacts';
import {CLI_AI_BLOCK_TYPES} from '../artifactTypeIds';
import {useRoomStore} from '../store';
import {isContextArtifactType} from './assistantUtils';

const CLI_BLOCK_CONTEXT_TYPES = new Set<string>(CLI_AI_BLOCK_TYPES);

function hasTableIdentity(
  tableIds: ReadonlySet<TableIdentity>,
  id: string,
): boolean {
  const tableIdentity = parseTableIdentity(id);
  return tableIdentity ? tableIds.has(tableIdentity) : false;
}

function getBlockTitle(target: BlockAiTarget): string {
  return defaultBlockTitle(target.blockType, target.title);
}

function blockTargetFromNode(
  blockDocumentId: string,
  node: Parameters<typeof blockDocumentNodeToBlock>[0],
): BlockAiTarget | undefined {
  const block = blockDocumentNodeToBlock(node);
  if (!block) return undefined;

  if (block.type === 'chart') {
    return {
      blockDocumentId,
      blockId: block.id,
      blockType: 'chart',
      title: block.caption,
    };
  }

  if (
    block.type === 'statefulBlock' &&
    CLI_BLOCK_CONTEXT_TYPES.has(block.blockType)
  ) {
    return {
      blockDocumentId,
      blockId: block.id,
      blockType: block.blockType,
      blockInstanceId: block.blockInstanceId,
      title: block.title ?? block.caption,
    };
  }

  return undefined;
}

/**
 * Hook to get context-eligible artifacts from the store
 */
export function useContextArtifacts(): ArtifactMetadata[] {
  const artifactOrder = useRoomStore((s) => s.artifacts.config.artifactOrder);
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);

  return useMemo(
    () =>
      artifactOrder
        .map((id) => artifactsById[id])
        .filter(
          (artifact): artifact is NonNullable<(typeof artifactsById)[string]> =>
            Boolean(artifact) && isContextArtifactType(artifact.type),
        ),
    [artifactOrder, artifactsById],
  );
}

/**
 * Hook to get context-eligible tables from the store
 */
export function useContextTables(): DataTable[] {
  return useRoomStore((s) => s.db.tables);
}

/**
 * Hook to build the full list of context selector items including missing ones
 */
export function useContextSelectorItems(): ContextSelectorItem[] {
  const artifacts = useContextArtifacts();
  const tables = useContextTables();
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const blockDocuments = useRoomStore((s) => s.blockDocuments.config.artifacts);
  const runContext = useRoomStore((s) => s.ai.getCurrentSession()?.runContext);
  const currentSessionId = useRoomStore((s) => s.ai.getCurrentSession()?.id);
  const owningArtifactId = useRoomStore((s) =>
    currentSessionId
      ? s.artifactAi.config.aiSessionArtifacts[currentSessionId]
      : undefined,
  );

  return useMemo<ContextSelectorItem[]>(() => {
    const artifactItems = artifacts
      .filter((artifact) => artifact.id !== owningArtifactId)
      .map((artifact) => ({
        id: artifact.id,
        kind: 'artifact',
        title: artifact.title,
        type: artifact.type,
        keywords: [artifact.title, artifact.type],
      }));

    const tableItems = tables.map((table) => {
      return {
        id: getTableIdentity(table.table),
        kind: 'table',
        title: getTableDisplayName(table.table),
        type: table.isView ? 'view' : 'table',
        subtitle: `${table.table.database}.${table.table.schema}`,
        keywords: [
          table.table.table,
          table.table.database ?? '',
          table.table.schema ?? '',
        ],
      };
    });

    const tableIdSet = new Set(tableItems.map((t) => t.id));
    const worksheetArtifactId =
      owningArtifactId && artifactsById[owningArtifactId]?.type === 'worksheet'
        ? owningArtifactId
        : currentArtifactId &&
            artifactsById[currentArtifactId]?.type === 'worksheet'
          ? currentArtifactId
          : undefined;
    const worksheet = worksheetArtifactId
      ? artifactsById[worksheetArtifactId]
      : undefined;
    const blockItems =
      worksheetArtifactId && worksheet
        ? (blockDocuments[worksheetArtifactId]?.content.content ?? [])
            .map((node) => blockTargetFromNode(worksheetArtifactId, node))
            .filter((target): target is BlockAiTarget => Boolean(target))
            .map((target) => ({
              id: blockContextItemId(target),
              kind: 'block',
              title: getBlockTitle(target),
              type: target.blockType,
              subtitle: `${defaultBlockTitle(target.blockType)} in ${worksheet.title}`,
              keywords: [
                getBlockTitle(target),
                target.blockType,
                worksheet.title,
                target.blockInstanceId ?? '',
              ],
            }))
        : [];
    const blockItemIdSet = new Set(blockItems.map((item) => item.id));

    const missingRunningItems = getAiRunContextItems(runContext)
      .filter((item) => {
        if (item.kind === 'artifact') {
          return (
            item.id !== owningArtifactId &&
            !artifactsById[item.id] &&
            item.type &&
            isContextArtifactType(item.type)
          );
        }
        if (item.kind === 'table') {
          return !hasTableIdentity(tableIdSet, item.id);
        }
        if (item.kind === 'block') {
          return !blockItemIdSet.has(item.id);
        }
        return false;
      })
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        type: item.type,
        missing: true,
        disabled: true,
        subtitle: 'Deleted',
        keywords: [item.title, item.type ?? ''],
      }));

    return [
      ...artifactItems,
      ...tableItems,
      ...blockItems,
      ...missingRunningItems,
    ];
  }, [
    artifacts,
    tables,
    artifactsById,
    owningArtifactId,
    currentArtifactId,
    blockDocuments,
    runContext,
  ]);
}

/**
 * Hook to get filtered selected IDs that are still valid context artifacts or tables
 */
export function useValidatedSelectedIds(): string[] {
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const blockDocuments = useRoomStore((s) => s.blockDocuments.config.artifacts);
  const owningArtifactId = useRoomStore((s) =>
    currentSession
      ? s.artifactAi.config.aiSessionArtifacts[currentSession.id]
      : undefined,
  );
  const tables = useContextTables();

  return useMemo(() => {
    const contextItemIds = getVisibleSessionContextItemIds(currentSession);
    const tableIdSet = new Set(
      tables.map((table) => getTableIdentity(table.table)),
    );

    return contextItemIds.filter((id) => {
      if (id === owningArtifactId) {
        return false;
      }
      const artifact = artifactsById[id];
      if (artifact && isContextArtifactType(artifact.type)) {
        return true;
      }
      const blockContext = parseBlockContextItemId(id);
      if (blockContext) {
        const blockDocument = blockDocuments[blockContext.blockDocumentId];
        if (!blockDocument) return false;
        return blockDocument.content.content.some(
          (node) => blockDocumentNodeId(node) === blockContext.blockId,
        );
      }
      // Check if it's a valid table ID
      return hasTableIdentity(tableIdSet, id);
    });
  }, [currentSession, artifactsById, owningArtifactId, tables, blockDocuments]);
}

/**
 * Hook to get running context IDs if session is running
 */
export function useRunningContextIds(): string[] | undefined {
  const sessionIsRunning = useRoomStore(
    (s) => s.ai.getCurrentSession()?.isRunning ?? false,
  );
  const runContext = useRoomStore((s) => s.ai.getCurrentSession()?.runContext);

  return sessionIsRunning
    ? getAiRunContextItems(runContext).map((item) => item.id)
    : undefined;
}
