import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
} from '@sqlrooms/project-builder';
import {MapIcon} from 'lucide-react';
import {z} from 'zod';
import {MainView} from './components/main-view.js';

export const AppConfig = BaseProjectConfig.extend({});
export type AppConfig = z.infer<typeof AppConfig>;

export type AppState = ProjectBuilderState<AppConfig>;

export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  ...createProjectBuilderSlice<AppConfig>({
    config: {
      title: 'Minimal SQLRooms App',
      dataSources: [
        {
          tableName: 'earthquakes',
          type: 'url',
          url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
        },
      ],
    },
    project: {
      panels: {
        main: {
          title: 'Main view',
          icon: MapIcon,
          component: MainView,
          placement: 'main',
        },
      },
    },
  })(set, get, store),
}));
