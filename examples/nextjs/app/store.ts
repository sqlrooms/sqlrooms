// import {MainView} from '@/components/main-view';
import {MainView} from '@/components/main-view';
import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
} from '@sqlrooms/project-builder';
import {MapIcon} from 'lucide-react';
import {z} from 'zod';

/**
 * Project config for saving
 */
export const AppConfig = BaseProjectConfig.extend({
  // Add custom config here
});
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
 */
export type AppState = ProjectBuilderState<AppConfig> & {
  // Add custom state type definitions here (fields and methods)
};

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  ...createProjectBuilderSlice<AppConfig>({
    config: {
      title: 'Demo App Project',
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
