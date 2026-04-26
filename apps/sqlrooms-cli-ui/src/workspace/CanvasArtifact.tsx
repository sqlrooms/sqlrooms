import {Canvas} from '@sqlrooms/canvas';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const CanvasArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const sheet = useRoomStore((state) => state.cells.config.sheets[artifactId]);
  const setCurrentSheet = useRoomStore((state) => state.cells.setCurrentSheet);

  useEffect(() => {
    if (sheet?.type === 'canvas') {
      setCurrentSheet(artifactId);
    }
  }, [artifactId, setCurrentSheet, sheet?.type]);

  if (!sheet || sheet.type !== 'canvas') {
    return null;
  }

  return <Canvas />;
};
