import {AiSettingsSliceState, AiSliceState} from '@sqlrooms/ai';
import {CanvasSliceState} from '@sqlrooms/canvas';
import {CellsSliceState} from '@sqlrooms/cells';
import type {
  MosaicDashboardSliceState,
  MosaicSliceState,
} from '@sqlrooms/mosaic';
import {NotebookSliceState} from '@sqlrooms/notebook';
import {RoomShellSliceState} from '@sqlrooms/room-shell';
import {SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {WebContainerSliceState} from '@sqlrooms/webcontainer';
import {z} from 'zod';

import {DbSettingsSliceState} from '@sqlrooms/db-settings';

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

export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState &
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
      ensureSheetDashboard: (sheetId: string) => void;
      setSheetVgPlot: (sheetId: string, vgplot: string) => void;
      getSheetVgPlot: (sheetId: string) => string | undefined;
      getCurrentDashboardSheetId: () => string | undefined;
      createDashboardSheet: (title?: string) => string;
      setCurrentSheetVgPlot: (vgplot: string) => string;
    };
  };
