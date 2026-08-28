import {getRunningAiSessionCountsByArtifact} from '@sqlrooms/artifacts/ai';
import {useCallback, useMemo} from 'react';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../../artifactTypeIds';
import {useRoomStore} from '../../roomStoreHooks';

export function useCliArtifactSidebarTabs() {
  const artifactsConfig = useRoomStore((state) => state.artifacts.config);
  const artifactTypes = useRoomStore((state) => state.artifacts.artifactTypes);
  const aiSessions = useRoomStore((state) => state.ai.config.sessions);
  const sessionArtifactLinks = useRoomStore(
    (state) => state.artifactAi.config.sessionArtifactLinks,
  );
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
  );
  const pinnedArtifactIds = useRoomStore(
    (state) => state.artifacts.config.pinnedArtifactIds,
  );
  const setCurrentArtifact = useRoomStore(
    (state) => state.artifacts.setCurrentArtifact,
  );
  const deleteArtifactFromStore = useRoomStore(
    (state) => state.artifacts.deleteArtifact,
  );
  const renameArtifactInStore = useRoomStore(
    (state) => state.artifacts.renameArtifact,
  );
  const togglePinArtifact = useRoomStore(
    (state) => state.artifacts.togglePinArtifact,
  );
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );

  const runningSessionCountsByArtifact = useMemo(() => {
    return getRunningAiSessionCountsByArtifact({
      sessions: aiSessions,
      sessionArtifactLinks,
    });
  }, [sessionArtifactLinks, aiSessions]);

  const tabs = useMemo(
    () =>
      artifactsConfig.artifactOrder
        .slice()
        .reverse()
        .map((artifactId) => artifactsConfig.artifactsById[artifactId])
        .filter((artifact) => {
          return (
            artifact &&
            CLI_ARTIFACT_TYPES.includes(artifact.type as CliArtifactType)
          );
        })
        .map((artifact) => ({
          id: artifact.id,
          name: artifact.title,
          type: artifact.type,
          isPinned: pinnedArtifactIds.includes(artifact.id),
          runningSessionCount: runningSessionCountsByArtifact[artifact.id] ?? 0,
        }))
        .sort((left, right) => {
          const leftPinned = pinnedArtifactIds.includes(left.id);
          const rightPinned = pinnedArtifactIds.includes(right.id);
          return Number(rightPinned) - Number(leftPinned);
        }),
    [
      artifactsConfig.artifactOrder,
      artifactsConfig.artifactsById,
      pinnedArtifactIds,
      runningSessionCountsByArtifact,
    ],
  );

  const selectArtifact = useCallback(
    (artifactId: string) => {
      if (!tabs.some((artifact) => artifact.id === artifactId)) return;
      setCurrentArtifact(artifactId);
      setShowArtifactChooser(false);
    },
    [setCurrentArtifact, setShowArtifactChooser, tabs],
  );
  const selectedTabId = useMemo(
    () =>
      currentArtifactId &&
      tabs.some((artifact) => artifact.id === currentArtifactId)
        ? currentArtifactId
        : undefined,
    [currentArtifactId, tabs],
  );

  const renameArtifact = useCallback(
    (artifactId: string, title: string) => {
      renameArtifactInStore(artifactId, title);
    },
    [renameArtifactInStore],
  );

  const deleteArtifact = useCallback(
    (artifactId: string) => {
      deleteArtifactFromStore(artifactId);
    },
    [deleteArtifactFromStore],
  );

  return {
    artifactTypes,
    deleteArtifact,
    renameArtifact,
    selectedTabId,
    selectArtifact,
    tabs,
    togglePinArtifact,
  };
}
