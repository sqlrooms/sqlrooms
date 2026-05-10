import {MarkdownDocument} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../store';

export const DocumentArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureDocument = useRoomStore(
    (state) => state.documents.ensureDocument,
  );

  useEffect(() => {
    if (artifact?.type === 'document') {
      ensureDocument(artifactId);
    }
  }, [artifact?.type, artifactId, ensureDocument]);

  if (!artifact || artifact.type !== 'document') {
    return null;
  }

  return <MarkdownDocument artifactId={artifactId} />;
};
