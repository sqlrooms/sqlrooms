import {useMemo} from 'react';
import {getVisibleSessionContextItemIds} from '@sqlrooms/ai';
import {CLI_ARTIFACT_TYPES} from '../artifactTypes';
import {useRoomStore} from '../store';

const SUPPORTED_CONTEXT_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

type ArtifactDragPayload = {
  kind: 'artifact';
  id: string;
  type: string;
  title?: string;
};

function isArtifactDragPayload(data: unknown): data is ArtifactDragPayload {
  if (!data || typeof data !== 'object') return false;
  const payload = data as Record<string, unknown>;
  return (
    payload.kind === 'artifact' &&
    typeof payload.id === 'string' &&
    typeof payload.type === 'string'
  );
}

export function isContextArtifactType(type: string) {
  return SUPPORTED_CONTEXT_ARTIFACT_TYPES.has(type);
}

export function useAssistantContextDropTarget() {
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const setSessionDraftContextItemIds = useRoomStore(
    (s) => s.ai.setSessionDraftContextItemIds,
  );
  const selectedIds = useMemo(
    () =>
      getVisibleSessionContextItemIds(currentSession),
    [currentSession],
  );

  return useMemo(
    () => ({
      id: 'assistant-context-drop-target',
      canAccept: (data: unknown) => {
        if (!isArtifactDragPayload(data)) return false;
        const artifact = artifactsById[data.id];
        return Boolean(artifact && isContextArtifactType(artifact.type));
      },
      onDrop: (data: unknown) => {
        if (!isArtifactDragPayload(data)) return;
        const artifact = artifactsById[data.id];
        if (!artifact || !isContextArtifactType(artifact.type)) return;
        const nextIds = selectedIds.includes(data.id)
          ? [data.id, ...selectedIds.filter((id) => id !== data.id)]
          : [...selectedIds, data.id];
        if (currentSession) {
          setSessionDraftContextItemIds(currentSession.id, nextIds);
        }
      },
    }),
    [
      artifactsById,
      currentSession,
      selectedIds,
      setSessionDraftContextItemIds,
    ],
  );
}
