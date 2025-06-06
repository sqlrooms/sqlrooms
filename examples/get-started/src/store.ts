import {
  BaseProjectConfig,
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
} from '@sqlrooms/project-builder';
import {MapIcon} from 'lucide-react';
import {z} from 'zod';
import {MainView} from './components/MainView';

/**
 * Project config schema is the part of the app state meant for saving.
 */
export const AppConfig = BaseProjectConfig.extend({
  // Add your project config here
});
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * The whole app state.
 */
export type AppState = ProjectBuilderState<AppConfig> & {
  // Add your app state here
};

/**
 * Create the project store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
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
        // For the minimal example we only define the main panel, no side panels
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
