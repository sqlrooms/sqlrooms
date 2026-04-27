import {
  ArtifactsSliceConfig,
  ArtifactsSliceState,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactTypeDefinition,
} from '@sqlrooms/artifacts';
import {
  PivotSliceConfig,
  PivotSliceState,
  createPivotSlice,
} from '@sqlrooms/pivot';
import {
  BaseRoomConfig,
  LayoutConfig,
  RoomShellSliceState,
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';
import {DatabaseIcon, TablePropertiesIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';
import {PivotPanel} from './components/PivotPanel';

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const DEFAULT_PIVOT_ARTIFACT_ID = 'pivot';

export type RoomState = RoomShellSliceState &
  ArtifactsSliceState &
  PivotSliceState;

export const PIVOT_ARTIFACT_TYPES = defineArtifactTypes({
  pivot: {
    label: 'Pivot',
    defaultTitle: 'Pivot 1',
    icon: TablePropertiesIcon,
    component: PivotPanel,
    onCreate: ({artifactId, artifact, store}) => {
      store.getState().pivot.ensurePivot(artifactId, {
        title: artifact.title,
        source: {kind: 'table', tableName: 'cars'},
      });
    },
    onEnsure: ({artifactId, artifact, store}) => {
      store.getState().pivot.ensurePivot(artifactId, {
        title: artifact.title,
        source: {kind: 'table', tableName: 'cars'},
        config: {
          rows: ['Cylinders'],
          cols: ['Origin'],
          aggregatorName: 'Count',
          vals: ['MPG'],
          rendererName: 'Grouped Column Chart',
          unusedOrder: ['Displacement', 'Horsepower', 'Weight', 'Acceleration'],
        },
      });
    },
    onRename: ({artifactId, artifact, store}) => {
      store.getState().pivot.renamePivot(artifactId, artifact.title);
    },
    onDelete: ({artifactId, store}) => {
      store.getState().pivot.removePivot(artifactId);
    },
  },
} satisfies Record<'pivot', ArtifactTypeDefinition<RoomState>>);

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'pivot-example-app-state-storage-v2',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        artifacts: ArtifactsSliceConfig,
        pivot: PivotSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          title: 'Pivot Example',
          description: 'DuckDB-backed pivot tables with Vega-Lite charts.',
          dataSources: [
            {
              type: 'url',
              url: 'https://huggingface.co/datasets/sqlrooms/cars/resolve/main/cars.parquet',
              tableName: 'cars',
            },
          ],
        },
        layout: {
          config: {
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum.left,
                children: [RoomPanelTypes.enum.data],
                defaultSize: '24%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'tabs',
                id: RoomPanelTypes.enum.main,
                panel: 'main',
                children: [],
                activeTabIndex: 0,
                defaultSize: '76%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum.data]: {
              title: 'Data',
              component: DataPanel,
              icon: DatabaseIcon,
            },
            [RoomPanelTypes.enum.main]: {
              title: 'Pivot',
              component: MainView,
              icon: TablePropertiesIcon,
            },
            artifact: createArtifactPanelDefinition(
              PIVOT_ARTIFACT_TYPES,
              store,
            ),
          },
        },
      })(set, get, store),
      ...createArtifactsSlice<RoomState>({
        artifactTypes: PIVOT_ARTIFACT_TYPES,
        config: {
          artifactsById: {
            [DEFAULT_PIVOT_ARTIFACT_ID]: {
              id: DEFAULT_PIVOT_ARTIFACT_ID,
              type: 'pivot',
              title: 'Pivot 1',
            },
          },
          artifactOrder: [DEFAULT_PIVOT_ARTIFACT_ID],
          currentArtifactId: DEFAULT_PIVOT_ARTIFACT_ID,
        },
      })(set, get, store),
      ...createPivotSlice()(set, get, store),
    }),
  ),
);
