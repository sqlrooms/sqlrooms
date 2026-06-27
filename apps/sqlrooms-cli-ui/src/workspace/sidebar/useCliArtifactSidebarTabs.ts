import {getRunningAiSessionCountsByArtifact} from '@sqlrooms/artifacts/ai';
import {useCallback, useMemo} from 'react';
import {CLI_ARTIFACT_TYPES, type CliArtifactType} from '../../artifactTypeIds';
import {useRoomStore} from '../../store';

export function useCliArtifactSidebarTabs() {
  const artifactsConfig = useRoomStore((state) => state.artifacts.config);
  const artifactTypes = useRoomStore((state) => state.artifacts.artifactTypes);
  const aiSessions = useRoomStore((state) => state.ai.config.sessions);
  const aiSessionArtifacts = useRoomStore(
    (state) => state.artifactAi.config.aiSessionArtifacts,
  );
  const currentArtifactId = useRoomStore(
    (state) => state.artifacts.config.currentArtifactId,
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
  const setShowArtifactChooser = useRoomStore(
    (state) => state.workspaceUi.setShowArtifactChooser,
  );

  const runningSessionCountsByArtifact = useMemo(() => {
    return getRunningAiSessionCountsByArtifact({
      sessions: aiSessions,
      aiSessionArtifacts,
    });
  }, [aiSessionArtifacts, aiSessions]);

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
          runningSessionCount: runningSessionCountsByArtifact[artifact.id] ?? 0,
        })),
    [
      artifactsConfig.artifactOrder,
      artifactsConfig.artifactsById,
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
        : tabs[0]?.id,
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
  };
}
