import {
  createArtifactTypeFromStatefulBlock,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {createMarkdownDocumentBlockDefinition} from '@sqlrooms/documents';
import {createMosaicDashboardBlockDefinition} from '@sqlrooms/mosaic';
import {createPivotBlockDefinition} from '@sqlrooms/pivot';
import {
  AppWindow,
  FileText,
  FileStackIcon,
  LayoutDashboardIcon,
} from 'lucide-react';
import {createSqlQueryBlockDefinition} from '@sqlrooms/sql-editor';
import type {RoomState} from './store-types';
import {STATEFUL_BLOCK_ARTIFACT_CONFIGS} from './statefulBlockArtifactConfigs';
import {WorksheetArtifact} from './workspace/WorksheetArtifact';
import {AppBuilderArtifact} from './workspace/AppBuilderArtifact';
import {CanvasArtifact} from './workspace/CanvasArtifact';
import {DashboardArtifact} from './workspace/dashboard/DashboardArtifact';
import {NotebookArtifact} from './workspace/dashboard/NotebookArtifact';
import {type CliArtifactType} from './artifactTypeIds';

const dashboardBlockDefinition =
  createMosaicDashboardBlockDefinition<RoomState>({
    label: STATEFUL_BLOCK_ARTIFACT_CONFIGS.dashboard.label,
    defaultTitle: STATEFUL_BLOCK_ARTIFACT_CONFIGS.dashboard.defaultTitle,
    render: DashboardArtifact,
  });

const pivotBlockDefinition = createPivotBlockDefinition<RoomState>({
  label: STATEFUL_BLOCK_ARTIFACT_CONFIGS.pivot.label,
  defaultTitle: STATEFUL_BLOCK_ARTIFACT_CONFIGS.pivot.defaultTitle,
});

const markdownDocumentBlockDefinition =
  createMarkdownDocumentBlockDefinition<RoomState>({
    label: STATEFUL_BLOCK_ARTIFACT_CONFIGS.document.label,
    defaultTitle: STATEFUL_BLOCK_ARTIFACT_CONFIGS.document.defaultTitle,
  });

const sqlQueryBlockDefinition = createSqlQueryBlockDefinition<RoomState>({
  label: STATEFUL_BLOCK_ARTIFACT_CONFIGS['sql-query'].label,
  defaultTitle: STATEFUL_BLOCK_ARTIFACT_CONFIGS['sql-query'].defaultTitle,
});

export const ARTIFACT_TYPES = defineArtifactTypes({
  worksheet: {
    label: 'Worksheet',
    defaultTitle: 'Worksheet',
    icon: FileStackIcon,
    component: WorksheetArtifact,
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
  dashboard: createArtifactTypeFromStatefulBlock(dashboardBlockDefinition),
  pivot: createArtifactTypeFromStatefulBlock(pivotBlockDefinition),
  notebook: {
    label: 'Notebook',
    defaultTitle: 'Notebook',
    icon: FileText,
    component: NotebookArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().notebook.ensureArtifact(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().notebook.ensureArtifact(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().notebook.removeArtifact(artifactId);
    },
  },
  document: createArtifactTypeFromStatefulBlock(
    markdownDocumentBlockDefinition,
  ),
  'sql-query': createArtifactTypeFromStatefulBlock(sqlQueryBlockDefinition),
  canvas: {
    label: 'Canvas',
    defaultTitle: 'Canvas',
    icon: LayoutDashboardIcon,
    component: CanvasArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().canvas.ensureArtifact(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().canvas.ensureArtifact(artifactId);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().canvas.removeArtifact(artifactId);
    },
  },
  app: {
    label: 'App',
    defaultTitle: 'App',
    icon: AppWindow,
    component: AppBuilderArtifact,
    onDelete: ({artifactId, store}) => {
      store.getState().appProject.removeArtifactApp(artifactId);
    },
  },
} satisfies Record<CliArtifactType, ArtifactTypeDefinition<RoomState>>);

export type ArtifactTypeInfo = (typeof ARTIFACT_TYPES)[CliArtifactType];
