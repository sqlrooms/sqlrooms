import {getArtifactIdsForAiSession} from '@sqlrooms/artifacts/ai';
import type {WorkspaceRoomState} from '../workspace/WorkspaceRoomStore';
import {DOCUMENT_CONTEXT_KIND} from './documentRunContext';

type SessionDocumentContextInput = {
  sessionId: string;
  primaryDocumentId?: string;
  sessionArtifactLinks: WorkspaceRoomState['artifactAi']['config']['sessionArtifactLinks'];
  artifactsById: WorkspaceRoomState['artifacts']['config']['artifactsById'];
  capturedAt?: number;
};

/** Builds the AI run context from the persisted many-to-many relationship. */
export function createSessionDocumentRunContext({
  sessionId,
  primaryDocumentId,
  sessionArtifactLinks,
  artifactsById,
  capturedAt = Date.now(),
}: SessionDocumentContextInput) {
  const documentIds = getArtifactIdsForAiSession({
    sessionArtifactLinks,
    sessionId,
  });
  const items = documentIds.flatMap((documentId) => {
    const document = artifactsById[documentId];
    if (!document || document.type !== 'document') return [];
    return [
      {
        kind: DOCUMENT_CONTEXT_KIND,
        id: document.id,
        title: document.title,
        type: document.type,
      },
    ];
  });
  const primaryId = items.some((item) => item.id === primaryDocumentId)
    ? primaryDocumentId
    : items.at(-1)?.id;

  return {
    items,
    primaryItemId: primaryId,
    primaryItemKind: primaryId ? DOCUMENT_CONTEXT_KIND : undefined,
    capturedAt,
  };
}

/** Refreshes one chat's run context after its linked document set changes. */
export function syncSessionDocumentRunContext(
  state: WorkspaceRoomState,
  sessionId: string,
  primaryDocumentId?: string,
) {
  state.ai.setSessionRunContext(
    sessionId,
    createSessionDocumentRunContext({
      sessionId,
      primaryDocumentId,
      sessionArtifactLinks: state.artifactAi.config.sessionArtifactLinks,
      artifactsById: state.artifacts.config.artifactsById,
    }),
  );
}
