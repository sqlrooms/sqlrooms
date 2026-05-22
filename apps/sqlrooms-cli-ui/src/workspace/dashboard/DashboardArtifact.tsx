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
  const startNewSession = useRoomStore((state) => state.ai.startNewSession);

  useEffect(() => {
    if (artifact?.type === 'dashboard') {
      ensureDashboardArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureDashboardArtifact]);

  const handleStart = useCallback(
    async (prompt: string) => {
      // TODO: figure out a better way to instruct agent to use specific agent and dashboard artifact without hardcoding dashboard_agent in the prompt
      const fullPrompt = `Use dashboard_agent to analyze the data and create charts in dashboard with id ${artifactId}. ${prompt}`;
      await startNewSession('Dashboard Analysis', fullPrompt);
    },
    [artifactId, startNewSession],
  );

  if (!artifact || artifact.type !== 'dashboard') {
    return null;
  }

  return <MosaicDashboard dashboardId={artifactId} onStart={handleStart} />;
};
