import {RoomPanelComponent} from '@sqlrooms/layout';
import {
  AppWindow,
  BarChart3,
  FileText,
  LayoutDashboardIcon,
} from 'lucide-react';
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

export type ArtifactTypeInfo = {
  title: string;
  addCommand: string;
  icon: React.ComponentType<{className?: string}>;
  component: RoomPanelComponent;
};

export const ARTIFACT_TYPES: Record<CliArtifactType, ArtifactTypeInfo> = {
  dashboard: {
    title: 'Dashboard',
    addCommand: 'dashboard.create-artifact',
    icon: BarChart3,
    component: DashboardArtifact,
  },
  notebook: {
    title: 'Notebook',
    addCommand: 'notebook.create-artifact',
    icon: FileText,
    component: NotebookArtifact,
  },
  canvas: {
    title: 'Canvas',
    addCommand: 'canvas.create-artifact',
    icon: LayoutDashboardIcon,
    component: CanvasArtifact,
  },
  app: {
    title: 'App',
    addCommand: 'app.create-artifact',
    icon: AppWindow,
    component: AppBuilderArtifact,
  },
};
