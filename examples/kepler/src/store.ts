import {
  createDefaultKeplerConfig,
  createKeplerSlice,
  KeplerSliceConfig,
  KeplerSliceState,
} from '@sqlrooms/kepler';
import {
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
} from '@sqlrooms/project-builder';
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {
  DatabaseIcon,
  Filter,
  Layers,
  Map as MapIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { z } from 'zod';
import { DataSourcesPanel } from './components/DataSourcesPanel';
import {
  KeplerSidePanelBaseMapManager,
  KeplerSidePanelFilterManager,
  KeplerSidePanelInteractionManager,
  KeplerSidePanelLayerManager,
} from './components/KeplerSidePanels';
import { MainView } from './components/MainView';

export const ProjectPanelTypes = z.enum([
  'data-sources',
  'kepler-layers',
  'kepler-filters',
  'kepler-interactions',
  'kepler-basemaps',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig =
  BaseProjectConfig.merge(KeplerSliceConfig).merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
type CustomAppState = {
  // TODO: Add custom state here
};
export type AppState = ProjectBuilderState<AppConfig> &
  KeplerSliceState &
  SqlEditorSliceState &
  CustomAppState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>((set, get, store) => {
  // Base project slice
  const projectSlice = createProjectBuilderSlice<AppConfig>({
    config: {
      layout: {
        type: LayoutTypes.enum.mosaic,
        nodes: {
          direction: 'row',
          first: ProjectPanelTypes.enum['data-sources'],
          second: MAIN_VIEW,
          splitPercentage: 30,
        },
      },
      dataSources: [
        {
          tableName: 'earthquakes',
          type: 'url',
          url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
        },
      ],
      ...createDefaultKeplerConfig(),
      ...createDefaultSqlEditorConfig(),
    },
    project: {
      panels: {
        [ProjectPanelTypes.enum['data-sources']]: {
          title: 'Data Sources',
          icon: DatabaseIcon,
          component: DataSourcesPanel,
          placement: 'sidebar',
        },
        [ProjectPanelTypes.enum['kepler-layers']]: {
          title: 'Layers',
          icon: Layers,
          component: KeplerSidePanelLayerManager,
          placement: 'sidebar',
        },
        [ProjectPanelTypes.enum['kepler-filters']]: {
          title: 'Filters',
          icon: Filter,
          component: KeplerSidePanelFilterManager,
          placement: 'sidebar',
        },
        [ProjectPanelTypes.enum['kepler-interactions']]: {
          title: 'Interactions',
          icon: SlidersHorizontal,
          component: KeplerSidePanelInteractionManager,
          placement: 'sidebar',
        },
        [ProjectPanelTypes.enum['kepler-basemaps']]: {
          title: 'Base Maps',
          icon: MapIcon,
          component: KeplerSidePanelBaseMapManager,
          placement: 'sidebar',
        },
        // MapIcon
        main: {
          title: 'Main view',
          icon: () => null,
          component: MainView,
          placement: 'main',
        },
      },
    },
  })(set, get, store);

  const keplerSlice = createKeplerSlice({
    actionLogging: true,
  })(set, get, store);
  return {
    ...projectSlice,
    project: {
      ...projectSlice.project,
      addProjectFile: async (file, tName, loadOptions) => {
        const addedTable = await projectSlice.project.addProjectFile(
          file,
          tName,
          loadOptions,
        );
        if (!addedTable) {
          return;
        }
        const currentMapId = get().config.kepler.currentMapId;
        get().kepler.addDataToMap(currentMapId, addedTable.tableName);
        return addedTable;

        // const connector = await get().db.getConnector();
        // const {tableName} = addedTable;
        // let fields: Field[] = [];
        // let cols: arrow.Vector[] = [];
        // try {
        //   const duckDbColumns = await getDuckDBColumnTypes(
        //     connector as unknown as DatabaseConnection,
        //     tableName,
        //   );
        //   const tableDuckDBTypes = getDuckDBColumnTypesMap(duckDbColumns);
        //   const columnsToConvertToWKB = getGeometryColumns(duckDbColumns);
        //   const adjustedQuery = constructST_asWKBQuery(
        //     tableName,
        //     columnsToConvertToWKB,
        //   );
        //   const arrowResult = await connector.query(adjustedQuery);
        //   fields = arrowSchemaToFields(arrowResult, tableDuckDBTypes);
        //   cols = [...Array(arrowResult.numCols).keys()]
        //     .map((i) => arrowResult.getChildAt(i))
        //     .filter((col) => col) as arrow.Vector[];
        // } catch (error) {
        //   console.error('kepler DuckDB: createTableAndGetArrow', error);
        // }
        // if (fields && cols) {
        //   const currentMapId = get().config.kepler.currentMapId;
        //   const datasets = {
        //     data: {
        //       fields,
        //       cols,
        //     },
        //     info: {
        //       label: tableName,
        //       id: tableName,
        //     },
        //   };
        //   keplerSlice.kepler.dispatchAction(currentMapId, addDataToMap({datasets}));
        // }
      },
    },

    ...keplerSlice,
    ...createSqlEditorSlice()(set, get, store),
  };
});
