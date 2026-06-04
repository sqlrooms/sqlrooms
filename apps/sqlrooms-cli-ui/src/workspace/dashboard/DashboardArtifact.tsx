import {
  MosaicDashboard,
  type MosaicDashboardBlockRenderProps,
} from '@sqlrooms/mosaic';
import {useEffect} from 'react';
import {useRoomStore, type RoomState} from '../../store';

export const DashboardArtifact = ({
  blockId: artifactId,
}: MosaicDashboardBlockRenderProps<RoomState>) => {
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
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
