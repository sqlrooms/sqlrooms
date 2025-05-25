import {DiscussionSliceState, createDiscussionSlice} from '@sqlrooms/discuss';
import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
} from '@sqlrooms/project-builder';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/project-config';
import {MessageCircleIcon} from 'lucide-react';
import {z} from 'zod';
import {MainView} from './components/MainView';
import {WasmDuckDbConnector} from '@sqlrooms/duckdb';
import DiscussionPanel from './components/DiscussionPanel';

export const ProjectPanelTypes = z.enum([
  'data-sources',
  'discuss',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

export const AppConfig = BaseProjectConfig;
export type AppConfig = z.infer<typeof AppConfig>;

export type AppState = ProjectBuilderState<AppConfig> & DiscussionSliceState;

export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  ...createProjectBuilderSlice<AppConfig>({
    connector: new WasmDuckDbConnector({
      initializationQuery: 'LOAD spatial',
    }),
    config: {
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
  ...createDiscussionSlice({
    userId: 'user1',
  })(set, get, store),
}));
