import {
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {FileSpreadsheet} from 'lucide-react';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {WorksheetArtifactPanel} from '../worksheet/WorksheetArtifact';

export const WORKSPACE_ARTIFACT_TYPES = defineArtifactTypes({
  document: {
    label: 'Document',
    defaultTitle: 'Document',
    icon: FileSpreadsheet,
    component: WorksheetArtifactPanel,
    onCreate: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().blockDocuments.ensureBlockDocument(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().blockDocuments.removeBlockDocument(artifactId);
    },
  },
} satisfies Record<'document', ArtifactTypeDefinition<WorkspaceRoomState>>);
