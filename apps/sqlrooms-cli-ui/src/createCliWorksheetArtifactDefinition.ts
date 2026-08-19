import type {ArtifactTypeDefinition} from '@sqlrooms/artifacts';
import type {RoomState} from './store-types';

/** Production lifecycle definition shared by the browser and headless targets. */
export function createCliWorksheetArtifactDefinition(): ArtifactTypeDefinition<RoomState> {
  return {
    label: 'Worksheet',
    defaultTitle: 'Worksheet',
    onCreate: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blockDocuments.removeBlockDocument(artifactId);
    },
  };
}
