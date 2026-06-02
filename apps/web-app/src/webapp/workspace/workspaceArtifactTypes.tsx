import {
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {FileSpreadsheet} from 'lucide-react';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {WorksheetArtifactPanel} from '../worksheet/worksheetRoomStore';

export const WORKSPACE_ARTIFACT_TYPES = defineArtifactTypes({
  worksheet: {
    label: 'Worksheet',
    defaultTitle: 'Worksheet',
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
} satisfies Record<'worksheet', ArtifactTypeDefinition<WorkspaceRoomState>>);
