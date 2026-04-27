import {AiSettingsSliceState, AiSliceState} from '@sqlrooms/ai';
import {ArtifactsSliceState} from '@sqlrooms/artifacts';
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

const AppBuilderProjectEntries = z.record(
  z.string(),
  z.object({
    name: z.string().default('Untitled App'),
    prompt: z.string().default(''),
    template: z.string().default('mosaic-dashboard'),
    files: z.record(z.string(), z.string()).default({}),
    updatedAt: z.number().default(0),
  }),
);

export const AppBuilderProjectConfig = z.object({
  appsByArtifactId: AppBuilderProjectEntries.default({}),
});
export type AppBuilderProjectConfig = z.infer<typeof AppBuilderProjectConfig>;
export const AppBuilderProjectConfigSchema = AppBuilderProjectConfig;

export type RoomState = RoomShellSliceState &
  ArtifactsSliceState &
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
      upsertArtifactApp: (
        artifactId: string,
        app: Partial<AppBuilderProjectConfig['appsByArtifactId'][string]> & {
          name: string;
        },
      ) => void;
      updateArtifactAppFiles: (
        artifactId: string,
        files: Record<string, string>,
      ) => void;
      getArtifactApp: (
        artifactId: string,
      ) => AppBuilderProjectConfig['appsByArtifactId'][string] | undefined;
    };
    dashboard: {
      initialize?: () => Promise<void>;
      destroy?: () => Promise<void>;
      ensureDashboardArtifact: (artifactId: string) => void;
      addProfilerForTable: (tableName: string) => string | undefined;
      setDashboardVgPlot: (artifactId: string, vgplot: string) => void;
      getDashboardVgPlot: (artifactId: string) => string | undefined;
      getCurrentDashboardArtifactId: () => string | undefined;
      createDashboardArtifact: (title?: string) => string;
      setCurrentDashboardVgPlot: (vgplot: string) => string;
    };
  };
