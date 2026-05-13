import {getAiRunContextItems, type ContextSelectorItem} from '@sqlrooms/ai';
import {useMemo} from 'react';
import {useRoomStore} from '../store';
import {isContextArtifactType} from './assistantUtils';

/**
 * Hook to get context-eligible artifacts from the store
 */
export function useContextArtifacts() {
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
 * Hook to build the full list of context selector items including missing ones
 */
export function useContextSelectorItems(): ContextSelectorItem[] {
  const artifacts = useContextArtifacts();
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const runContext = useRoomStore((s) => s.ai.getCurrentSession()?.runContext);

  return useMemo<ContextSelectorItem[]>(() => {
    const artifactItems = artifacts.map((artifact) => ({
      id: artifact.id,
      kind: 'artifact',
      title: artifact.title,
      type: artifact.type,
      keywords: [artifact.title, artifact.type],
    }));

    const missingRunningItems = getAiRunContextItems(runContext)
      .filter(
        (item) =>
          item.kind === 'artifact' &&
          !artifactsById[item.id] &&
          item.type &&
          isContextArtifactType(item.type),
      )
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

    return [...artifactItems, ...missingRunningItems];
  }, [artifacts, artifactsById, runContext]);
}

/**
 * Hook to get filtered selected IDs that are still valid context artifacts
 */
export function useValidatedSelectedIds() {
  const aiContextItemIds = useRoomStore((s) => s.aiContextItemIds);
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);

  return useMemo(() => {
    return aiContextItemIds.filter((id) => {
      const artifact = artifactsById[id];
      return artifact && isContextArtifactType(artifact.type);
    });
  }, [aiContextItemIds, artifactsById]);
}

/**
 * Hook to get running context IDs if session is running
 */
export function useRunningContextIds() {
  const sessionIsRunning = useRoomStore(
    (s) => s.ai.getCurrentSession()?.isRunning ?? false,
  );
  const runContext = useRoomStore((s) => s.ai.getCurrentSession()?.runContext);

  return sessionIsRunning
    ? getAiRunContextItems(runContext).map((item) => item.id)
    : undefined;
}
