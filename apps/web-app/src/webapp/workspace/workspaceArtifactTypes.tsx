import {
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {FileSpreadsheet} from 'lucide-react';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {DocumentArtifactPanel} from '../document/DocumentArtifact';

export const WORKSPACE_ARTIFACT_TYPES = defineArtifactTypes({
  document: {
    label: 'Document',
    defaultTitle: 'Document',
    icon: FileSpreadsheet,
    component: DocumentArtifactPanel,
    onCreate: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blockDocuments.removeBlockDocument(artifactId);
      store.getState().artifactAi.removeAllLinksForArtifact(artifactId);
    },
  },
} satisfies Record<'document', ArtifactTypeDefinition<WorkspaceRoomState>>);
