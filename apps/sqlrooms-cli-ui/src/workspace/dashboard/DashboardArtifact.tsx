import {MosaicDashboard} from '@sqlrooms/mosaic';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../../store';

export const DashboardArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) => state.artifacts.getItem(artifactId));
  const ensureDashboardArtifact = useRoomStore(
    (state) => state.dashboard.ensureDashboardArtifact,
  );

  useEffect(() => {
    if (artifact?.type === 'dashboard') {
      ensureDashboardArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureDashboardArtifact]);

  if (!artifact || artifact.type !== 'dashboard') {
    return null;
  }

  return <MosaicDashboard dashboardId={artifactId} />;
};
