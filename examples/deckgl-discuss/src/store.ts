import {
  createDefaultDiscussConfig,
  createDiscussSlice,
  DiscussSliceConfig,
  DiscussSliceState,
} from '@sqlrooms/discuss';
import {WasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
  StateCreator,
} from '@sqlrooms/project-builder';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/project-config';
import {MessageCircleIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import DiscussionPanel from './components/DiscussionPanel';
import {MainView} from './components/MainView';

export const ProjectPanelTypes = z.enum([
  'data-sources',
  'discuss',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

export const AppConfig = BaseProjectConfig.merge(DiscussSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

export type AppState = ProjectBuilderState<AppConfig> & DiscussSliceState;

export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      ...createDiscussSlice({userId: 'user1'})(set, get, store),

      ...createProjectBuilderSlice<AppConfig>({
        connector: new WasmDuckDbConnector({
          initializationQuery: 'LOAD spatial',
        }),
        config: {
          ...createDefaultDiscussConfig(),
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: ProjectPanelTypes.enum['discuss'],
              second: ProjectPanelTypes.enum['main'],
              splitPercentage: 30,
            },
          },
          dataSources: [
            {
              type: 'url',
              // source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
              url: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson',
              tableName: 'airports',
              loadOptions: {
                method: 'st_read',
              },
            },
          ],
        },
        project: {
          panels: {
            [ProjectPanelTypes.enum['discuss']]: {
              title: 'Discuss',
              icon: MessageCircleIcon,
              component: DiscussionPanel,
              placement: 'sidebar',
            },
            main: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
              placement: 'main',
            },
          },
        },
      })(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'discuss-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: AppConfig.parse(state.config),
      }),
    },
  ) as StateCreator<AppState>,
);
