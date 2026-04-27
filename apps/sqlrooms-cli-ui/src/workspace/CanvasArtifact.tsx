import {Canvas} from '@sqlrooms/canvas';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const CanvasArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureArtifact = useRoomStore((state) => state.canvas.ensureArtifact);

  useEffect(() => {
    if (artifact?.type === 'canvas') {
      ensureArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureArtifact]);

  if (!artifact || artifact.type !== 'canvas') {
    return null;
  }

  return <Canvas artifactId={artifactId} />;
};
