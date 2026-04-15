import {CreateLayoutSliceProps} from '@sqlrooms/layout';
import {
  DatabaseIcon,
  FolderIcon,
  LayoutDashboardIcon,
  SparklesIcon,
} from 'lucide-react';
import {StoreApi} from 'zustand';
import {ARTIFACT_TYPES} from './artifactTypes';
import {AssistantPanel} from './components/AssistantPanel';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {RoomState} from './store-types';
import {ArtifactsContainerPanel} from './workspace/ArtifactsContainerPanel';

export const createLayout = ({
  store,
}: {
  store: StoreApi<RoomState>;
}): CreateLayoutSliceProps => ({
  config: {
    id: 'root',
    type: 'split',
    direction: 'row',
    children: [
      {
        type: 'tabs',
        id: 'left',
        defaultSize: '30%',
        minSize: 250,
        maxSize: 400,
        children: ['data-sources'],
        activeTabIndex: 0,
        collapsible: true,
        collapsedSize: 0,
      },
      {
        type: 'tabs',
        id: 'workspace',
        defaultSize: '70%',
        children: [],
        activeTabIndex: 0,
      },
      {
        type: 'panel',
        id: 'assistant',
        defaultSize: 250,
        minSize: 250,
        maxSize: 600,
        collapsible: true,
        collapsedSize: 0,
      },
    ],
  },
  panels: {
    'data-sources': {
      title: 'Data Sources',
      icon: DatabaseIcon,
      component: DataSourcesPanel,
    },
    assistant: {
      component: AssistantPanel,
      title: 'AI Assistant',
      icon: SparklesIcon,
    },
    workspace: {
      component: ArtifactsContainerPanel,
      title: 'Artifacts',
      icon: FolderIcon,
    },
    'workspace/{artifactId}': (ctx) => {
      const panelId = ctx.params.artifactId;
      const panelSheet = store.getState().cells.config.sheets[panelId];
      const types = panelSheet ? ARTIFACT_TYPES[panelSheet.type] : undefined;
      const component = types?.component;
      if (!component) {
        // fallback to a null component
        return {
          component: () => null,
          title: `Unknown panel ${panelId}`,
          icon: LayoutDashboardIcon,
        };
      }
      return {
        component,
        title: panelSheet?.title || `Panel ${panelId}`,
        icon: LayoutDashboardIcon,
      };
    },
  },
});
