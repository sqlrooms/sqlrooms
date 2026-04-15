import {AiSettingsSliceState, AiSliceState} from '@sqlrooms/ai';
import {CanvasSliceState} from '@sqlrooms/canvas';
import {CellsSliceState} from '@sqlrooms/cells';
import type {MosaicSliceState} from '@sqlrooms/mosaic';
import {NotebookSliceState} from '@sqlrooms/notebook';
import {RoomShellSliceState} from '@sqlrooms/room-shell';
import {SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {WebContainerSliceState} from '@sqlrooms/webcontainer';
import {z} from 'zod';

import {DbSettingsSliceState} from '@sqlrooms/db-settings';
import {DEFAULT_DASHBOARD_VGPLOT_SPEC} from './vgplot';

export const AppBuilderProjectConfig = z.object({
  appsBySheetId: z
    .record(
      z.string(),
      z.object({
        name: z.string().default('Untitled App'),
        prompt: z.string().default(''),
        template: z.string().default('mosaic-dashboard'),
        files: z.record(z.string(), z.string()).default({}),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type AppBuilderProjectConfig = z.infer<typeof AppBuilderProjectConfig>;

export const DashboardChartConfig = z.object({
  id: z.string(),
  title: z.string().default('Chart'),
  vgplot: z.string().default(DEFAULT_DASHBOARD_VGPLOT_SPEC),
});
export type DashboardChartConfig = z.infer<typeof DashboardChartConfig>;

export const DashboardProjectConfig = z.object({
  dashboardsBySheetId: z
    .record(
      z.string(),
      z.object({
        vgplot: z.string().default(DEFAULT_DASHBOARD_VGPLOT_SPEC),
        charts: z.array(DashboardChartConfig).default([]),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type DashboardProjectConfig = z.infer<typeof DashboardProjectConfig>;

export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState &
  CellsSliceState &
  NotebookSliceState &
  CanvasSliceState &
  WebContainerSliceState &
  DbSettingsSliceState & {
    appProject: {
      config: AppBuilderProjectConfig;
      upsertSheetApp: (
        sheetId: string,
        app: Partial<AppBuilderProjectConfig['appsBySheetId'][string]> & {
          name: string;
        },
      ) => void;
      updateSheetAppFiles: (
        sheetId: string,
        files: Record<string, string>,
      ) => void;
      getSheetApp: (
        sheetId: string,
      ) => AppBuilderProjectConfig['appsBySheetId'][string] | undefined;
    };
    dashboard: {
      initialize?: () => Promise<void>;
      destroy?: () => Promise<void>;
      config: DashboardProjectConfig;
      ensureSheetDashboard: (sheetId: string) => void;
      setSheetVgPlot: (sheetId: string, vgplot: string) => void;
      getSheetVgPlot: (sheetId: string) => string | undefined;
      getCurrentDashboardSheetId: () => string | undefined;
      createDashboardSheet: (title?: string) => string;
      setCurrentSheetVgPlot: (vgplot: string) => string;
      addChart: (sheetId: string, chart: DashboardChartConfig) => void;
      removeChart: (sheetId: string, chartId: string) => void;
      updateChart: (
        sheetId: string,
        chartId: string,
        patch: Partial<Pick<DashboardChartConfig, 'title' | 'vgplot'>>,
      ) => void;
      getCharts: (sheetId: string) => DashboardChartConfig[];
    };
  };
