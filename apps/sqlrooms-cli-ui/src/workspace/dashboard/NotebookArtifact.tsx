import {Notebook} from '@sqlrooms/notebook';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../../store';

export const NotebookArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureArtifact = useRoomStore((state) => state.notebook.ensureArtifact);

  useEffect(() => {
    if (artifact?.type === 'notebook') {
      ensureArtifact(artifactId);
    }
  }, [artifact?.type, artifactId, ensureArtifact]);

  if (!artifact || artifact.type !== 'notebook') {
    return null;
  }

  return <Notebook artifactId={artifactId} />;
};
