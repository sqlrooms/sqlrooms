import {
  createHtmlAppBlockDefinition,
  HTML_APP_BLOCK_TYPE,
} from '@sqlrooms/app-runtime';
import {
  createArtifactTypeFromStatefulBlock,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {createMarkdownDocumentBlockDefinition} from '@sqlrooms/documents';
import {createMosaicDashboardBlockDefinition} from '@sqlrooms/mosaic';
import {createPivotBlockDefinition} from '@sqlrooms/pivot';
import {createPythonBlockDefinition} from '@sqlrooms/python/block';
import type {RoomPanelComponent} from '@sqlrooms/layout';
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

type FeatureStability = 'stable' | 'experimental';

type CliArtifactTypeDefinition = ArtifactTypeDefinition<RoomState> & {
  stability: FeatureStability;
};

const ARTIFACT_STABILITY = {
  worksheet: 'stable',
  dashboard: 'stable',
  pivot: 'experimental',
  notebook: 'experimental',
  document: 'experimental',
  'sql-query': 'experimental',
  'html-app': 'experimental',
  python: 'experimental',
  canvas: 'experimental',
  'app-builder': 'experimental',
} as const satisfies Record<CliArtifactType, FeatureStability>;

const ExperimentalArtifactPlaceholder: RoomPanelComponent = ({panelInfo}) => {
  return (
    <div className="bg-background flex h-full min-h-0 flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-md border p-5">
        <div className="text-sm font-medium">
          {panelInfo.title || 'Experimental artifact'}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          This artifact uses an experimental SQLRooms surface. Reopen this
          project with --experimental to view and edit it.
        </p>
      </div>
    </div>
  );
};

function withStability<T extends ArtifactTypeDefinition<RoomState>>(
  type: CliArtifactType,
  definition: T,
  experimentalEnabled: boolean,
): CliArtifactTypeDefinition {
  const stability = ARTIFACT_STABILITY[type];
  if (stability === 'stable' || experimentalEnabled) {
    return {...definition, stability, canCreate: true};
  }
  return {
    ...definition,
    stability,
    canCreate: false,
    component: ExperimentalArtifactPlaceholder,
    onCreate: undefined,
    onEnsure: undefined,
  };
}

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

const htmlAppBlockDefinition = createHtmlAppBlockDefinition<RoomState>({
  label: STATEFUL_BLOCK_ARTIFACT_CONFIGS[HTML_APP_BLOCK_TYPE].label,
  defaultTitle:
    STATEFUL_BLOCK_ARTIFACT_CONFIGS[HTML_APP_BLOCK_TYPE].defaultTitle,
  defaultApp: {
    requestedCapabilities: ['query'],
    grantedCapabilities: ['query'],
  },
});

const pythonBlockDefinition = createPythonBlockDefinition<RoomState>({
  label: STATEFUL_BLOCK_ARTIFACT_CONFIGS.python.label,
  defaultTitle: STATEFUL_BLOCK_ARTIFACT_CONFIGS.python.defaultTitle,
});

export function createCliArtifactTypes({
  experimentalEnabled = false,
}: {
  experimentalEnabled?: boolean;
} = {}) {
  const worksheetDefinition: ArtifactTypeDefinition<RoomState> = {
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
  };

  const notebookDefinition: ArtifactTypeDefinition<RoomState> = {
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
  };

  const canvasDefinition: ArtifactTypeDefinition<RoomState> = {
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
  };

  const appDefinition: ArtifactTypeDefinition<RoomState> = {
    label: 'App Builder',
    defaultTitle: 'App Builder',
    icon: AppWindow,
    component: AppBuilderArtifact,
    onDelete: ({artifactId, store}) => {
      store.getState().appProject.removeArtifactApp(artifactId);
    },
  };

  return defineArtifactTypes({
    worksheet: withStability(
      'worksheet',
      worksheetDefinition,
      experimentalEnabled,
    ),
    dashboard: withStability(
      'dashboard',
      createArtifactTypeFromStatefulBlock(dashboardBlockDefinition),
      experimentalEnabled,
    ),
    pivot: withStability(
      'pivot',
      createArtifactTypeFromStatefulBlock(pivotBlockDefinition),
      experimentalEnabled,
    ),
    notebook: withStability(
      'notebook',
      notebookDefinition,
      experimentalEnabled,
    ),
    document: withStability(
      'document',
      createArtifactTypeFromStatefulBlock(markdownDocumentBlockDefinition),
      experimentalEnabled,
    ),
    'sql-query': withStability(
      'sql-query',
      createArtifactTypeFromStatefulBlock(sqlQueryBlockDefinition),
      experimentalEnabled,
    ),
    'html-app': withStability(
      'html-app',
      createArtifactTypeFromStatefulBlock(htmlAppBlockDefinition),
      experimentalEnabled,
    ),
    python: withStability(
      'python',
      createArtifactTypeFromStatefulBlock(pythonBlockDefinition),
      experimentalEnabled,
    ),
    canvas: withStability('canvas', canvasDefinition, experimentalEnabled),
    'app-builder': withStability(
      'app-builder',
      appDefinition,
      experimentalEnabled,
    ),
  } satisfies Record<CliArtifactType, CliArtifactTypeDefinition>);
}

export type ArtifactTypeInfo = ReturnType<
  typeof createCliArtifactTypes
>[CliArtifactType];
