import {
  MosaicDashboard,
  type MosaicDashboardBlockRenderProps,
} from '@sqlrooms/mosaic';
import {FC, useEffect} from 'react';
import {useRoomStore, type RoomState} from '../../store';

export const DashboardArtifact: FC<
  MosaicDashboardBlockRenderProps<RoomState>
> = ({blockId: artifactId}) => {
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
