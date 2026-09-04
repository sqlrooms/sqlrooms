import type {ArtifactMetadata} from '@sqlrooms/artifacts';
import {getArtifactIdsForAiSession} from '@sqlrooms/artifacts/ai';
import {useMemo} from 'react';
import {useRoomStore} from '../roomStoreHooks';

/** Returns the artifacts linked to a chat in link order. */
export function useSessionArtifacts(sessionId?: string): ArtifactMetadata[] {
  const sessionArtifactLinks = useRoomStore(
    (state) => state.artifactAi.config.sessionArtifactLinks,
  );
  const artifactsById = useRoomStore(
    (state) => state.artifacts.config.artifactsById,
  );

  return useMemo(() => {
    if (!sessionId) return [];
    return getArtifactIdsForAiSession({sessionArtifactLinks, sessionId})
      .map((artifactId) => artifactsById[artifactId])
      .filter((artifact): artifact is ArtifactMetadata => Boolean(artifact));
  }, [artifactsById, sessionArtifactLinks, sessionId]);
}
