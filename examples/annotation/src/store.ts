import {
  createProjectBuilderSlice,
  createProjectBuilderStore,
  ProjectBuilderState,
  BaseProjectConfig,
} from '@sqlrooms/project-builder';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/project-config';
import {
  createAnnotationSlice,
  AnnotationSliceState,
} from '@sqlrooms/annotation';
import {DatabaseIcon, MessageCircleIcon} from 'lucide-react';
import {z} from 'zod';
import {MainView} from './components/MainView.js';
import AnnotationPanel from './components/AnnotationPanel.js';

export const ProjectPanelTypes = z.enum([
  'data-sources',
  'annotations',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

export const AppConfig = BaseProjectConfig;
export type AppConfig = z.infer<typeof AppConfig>;

export type AppState = ProjectBuilderState<AppConfig> & AnnotationSliceState;

export const {projectStore, useProjectStore} = createProjectBuilderStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  ...createProjectBuilderSlice<AppConfig>({
    config: {
      layout: {
        type: LayoutTypes.enum.mosaic,
        nodes: {
          direction: 'row',
          first: ProjectPanelTypes.enum['annotations'],
          second: ProjectPanelTypes.enum['main'],
          splitPercentage: 30,
        },
      },
      dataSources: [
        {
          type: 'url',
          url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
          tableName: 'earthquakes',
        },
      ],
    },
    project: {
      panels: {
        [ProjectPanelTypes.enum['annotations']]: {
          title: 'Annotations',
          icon: MessageCircleIcon,
          component: AnnotationPanel,
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
  ...createAnnotationSlice({userId: 'user1'})(set, get, store),
}));
