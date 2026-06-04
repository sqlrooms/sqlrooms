import {Canvas} from '@sqlrooms/canvas';
import type {RoomPanelComponent} from '@sqlrooms/layout';

export const CanvasArtifactPanel: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  return <Canvas artifactId={artifactId} />;
};
