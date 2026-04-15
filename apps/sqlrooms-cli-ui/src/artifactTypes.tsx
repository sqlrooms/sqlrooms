import {Canvas} from '@sqlrooms/canvas';
import {SheetType} from '@sqlrooms/cells';
import {RoomPanelComponent} from '@sqlrooms/layout';
import {
  AppWindow,
  BarChart3,
  FileText,
  LayoutDashboardIcon,
} from 'lucide-react';
import {AppBuilderSheet} from './workspace/AppBuilderSheet';
import {DashboardSheet} from './workspace/dashboard/DashboardSheet';
import {NotebookSheet} from './workspace/dashboard/NotebookSheet';

export type ArtifactTypeInfo = {
  title: string;
  addCommand: string;
  icon: React.ComponentType<{className?: string}>;
  component: RoomPanelComponent;
};
export const ARTIFACT_TYPES: Record<SheetType, ArtifactTypeInfo> = {
  notebook: {
    title: 'Notebook',
    addCommand: 'notebook.create-sheet',
    icon: FileText,
    component: NotebookSheet,
  },
  canvas: {
    title: 'Canvas',
    addCommand: 'canvas.create-sheet',
    icon: LayoutDashboardIcon,
    component: Canvas,
  },
  app: {
    title: 'App',
    addCommand: 'app.create-sheet',
    icon: AppWindow,
    component: AppBuilderSheet,
  },
  dashboard: {
    title: 'Dashboard',
    addCommand: 'dashboard.create-sheet',
    icon: BarChart3,
    component: DashboardSheet,
  },
};
