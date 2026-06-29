import {
  getAiRunContextItems,
  getVisibleSessionContextItemIds,
  type ContextSelectorItem,
} from '@sqlrooms/ai';
import {
  getTableDisplayName,
  getTableIdentity,
  type DataTable,
} from '@sqlrooms/duckdb';
import {useMemo} from 'react';
import type {ArtifactMetadata} from '@sqlrooms/artifacts';
import {useRoomStore} from '../store';
import {isContextArtifactType} from './assistantUtils';

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
          return !tableIdSet.has(item.id);
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

    return [...artifactItems, ...tableItems, ...missingRunningItems];
  }, [artifacts, tables, artifactsById, owningArtifactId, runContext]);
}

/**
 * Hook to get filtered selected IDs that are still valid context artifacts or tables
 */
export function useValidatedSelectedIds(): string[] {
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
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
      // Check if it's a valid table ID
      return tableIdSet.has(id);
    });
  }, [currentSession, artifactsById, owningArtifactId, tables]);
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
