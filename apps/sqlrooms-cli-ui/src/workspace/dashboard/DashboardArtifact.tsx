import {MosaicDashboard} from '@sqlrooms/mosaic';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useCallback, useEffect} from 'react';
import {useRoomStore} from '../../store';

export const DashboardArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureDashboardArtifact = useRoomStore(
    (state) => state.dashboard.ensureDashboardArtifact,
  );
  const createSession = useRoomStore((state) => state.ai.createSession);
  const setPrompt = useRoomStore((state) => state.ai.setPrompt);

  useEffect(() => {
    if (artifact?.type === 'dashboard') {
      ensureDashboardArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureDashboardArtifact]);

  const handleStart = useCallback(
    async (tableName: string, prompt?: string) => {
      if (prompt) {
        // Create a new AI session for this analysis
        const sessionId = createSession(`Analyze ${tableName}`);

        // Set the prompt in the new session
        const fullPrompt = `I want to analyze the "${tableName}" table. ${prompt}`;
        setPrompt(sessionId, fullPrompt);
      }
    },
    [createSession, setPrompt],
  );

  if (!artifact || artifact.type !== 'dashboard') {
    return null;
  }

  return <MosaicDashboard dashboardId={artifactId} onStart={handleStart} />;
};
