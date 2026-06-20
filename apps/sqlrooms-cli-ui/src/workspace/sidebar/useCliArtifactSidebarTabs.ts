import {createArtifactLayoutNode} from '@sqlrooms/artifacts';
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
  const selectedTabId = useRoomStore((state) =>
    state.layout.getActiveTab('workspace'),
  );
  const addTab = useRoomStore((state) => state.layout.addTab);
  const setActiveTab = useRoomStore((state) => state.layout.setActiveTab);
  const deleteTab = useRoomStore((state) => state.layout.deleteTab);
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
      addTab('workspace', createArtifactLayoutNode(artifactId, 'artifact'));
      setActiveTab('workspace', artifactId);
      setCurrentArtifact(artifactId);
      setShowArtifactChooser(false);
    },
    [addTab, setActiveTab, setCurrentArtifact, setShowArtifactChooser],
  );

  const renameArtifact = useCallback(
    (artifactId: string, title: string) => {
      renameArtifactInStore(artifactId, title);
    },
    [renameArtifactInStore],
  );

  const deleteArtifact = useCallback(
    (artifactId: string) => {
      const activeArtifactId = selectedTabId;
      deleteArtifactFromStore(artifactId);
      deleteTab('workspace', artifactId);
      if (activeArtifactId && activeArtifactId !== artifactId) {
        setActiveTab('workspace', activeArtifactId);
      }
    },
    [deleteArtifactFromStore, deleteTab, selectedTabId, setActiveTab],
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
