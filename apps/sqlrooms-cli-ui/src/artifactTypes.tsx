import {
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {
  AppWindow,
  BarChart3,
  FileText,
  LayoutDashboardIcon,
} from 'lucide-react';
import type {RoomState} from './store-types';
import {AppBuilderArtifact} from './workspace/AppBuilderArtifact';
import {CanvasArtifact} from './workspace/CanvasArtifact';
import {DashboardArtifact} from './workspace/dashboard/DashboardArtifact';
import {NotebookArtifact} from './workspace/dashboard/NotebookArtifact';

export const CLI_ARTIFACT_TYPES = [
  'dashboard',
  'notebook',
  'canvas',
  'app',
] as const;
export type CliArtifactType = (typeof CLI_ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPES = defineArtifactTypes({
  dashboard: {
    label: 'Dashboard',
    defaultTitle: 'Dashboard',
    icon: BarChart3,
    component: DashboardArtifact,
    onCreate: ({artifactId, store}) => {
      store.getState().dashboard.ensureDashboardArtifact(artifactId);
    },
    onEnsure: ({artifactId, store}) => {
      store.getState().dashboard.ensureDashboardArtifact(artifactId);
    },
    onClose: ({artifactId, store}) => {
      store.getState().mosaicDashboard.evictDashboardRuntime(artifactId, {
        resetSelection: true,
      });
    },
    onDelete: ({artifactId, store}) => {
      store.getState().mosaicDashboard.removeDashboard(artifactId);
    },
  },
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
