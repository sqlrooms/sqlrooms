import {Canvas} from '@sqlrooms/canvas';
import {SheetType} from '@sqlrooms/cells';
import {RoomPanelComponent} from '@sqlrooms/layout';
import {Notebook} from '@sqlrooms/notebook';
import {
  AppWindow,
  BarChart3,
  FileText,
  LayoutDashboardIcon,
} from 'lucide-react';
import {AppBuilderSheet} from './workspace/AppBuilderSheet';
import {DashboardSheet} from './workspace/DashboardSheet';

export type ArtifactTypeInfo = {
  title: string;
  addCommand: string;
  icon: React.ElementType;
  component: RoomPanelComponent;
};
export const ARTIFACT_TYPES: Record<SheetType, ArtifactTypeInfo> = {
  notebook: {
    title: 'Notebook',
    addCommand: 'notebook.create-sheet',
    icon: FileText,
    component: Notebook,
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
