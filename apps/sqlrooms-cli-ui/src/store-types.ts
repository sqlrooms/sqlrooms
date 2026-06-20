import {AiSettingsSliceState, AiSliceState} from '@sqlrooms/ai';
import {HtmlAppRuntimeSliceState} from '@sqlrooms/app-runtime';
import {ArtifactsSliceState} from '@sqlrooms/artifacts';
import {type ArtifactAiSliceState} from '@sqlrooms/artifacts/ai';
import {CanvasSliceState} from '@sqlrooms/canvas';
import {CellsSliceState} from '@sqlrooms/cells';
import {CrdtSliceState} from '@sqlrooms/crdt';
import {
  BlockDocumentsSliceState,
  DocumentsSliceState,
} from '@sqlrooms/documents';
import type {
  MosaicDashboardLayoutType,
  MosaicDashboardSliceState,
  MosaicSliceState,
} from '@sqlrooms/mosaic';
import {NotebookSliceState} from '@sqlrooms/notebook';
import {PivotSliceState} from '@sqlrooms/pivot';
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
  ArtifactAiSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState &
  HtmlAppRuntimeSliceState &
  CellsSliceState &
  NotebookSliceState &
  PivotSliceState &
  CanvasSliceState &
  DocumentsSliceState &
  BlockDocumentsSliceState &
  CrdtSliceState &
  WebContainerSliceState &
  DbSettingsSliceState & {
    workspaceUi: {
      showArtifactChooser: boolean;
      setShowArtifactChooser: (show: boolean) => void;
    };
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
      removeArtifactApp: (artifactId: string) => void;
      getArtifactApp: (
        artifactId: string,
      ) => AppBuilderProjectConfig['appsByArtifactId'][string] | undefined;
    };
    dashboard: {
      initialize?: () => Promise<void>;
      destroy?: () => Promise<void>;
      ensureDashboardArtifact: (artifactId: string) => void;
      addDataTableExplorerForTable: (tableName: string) => string | undefined;
      getCurrentDashboardArtifactId: () => string | undefined;
      createDashboardArtifact: (
        title?: string,
        layoutType?: MosaicDashboardLayoutType,
      ) => string;
    };
  };
