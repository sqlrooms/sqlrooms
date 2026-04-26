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
        id: 'left-sidebar',
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
        panel: 'workspace',
        defaultSize: '70%',
        children: [],
        activeTabIndex: 0,
      },
      {
        type: 'panel',
        id: 'assistant-sidebar',
        panel: {
          key: 'assistant',
        },
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
      title: 'Data',
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
    artifact: (ctx) => {
      const artifactId = ctx.meta?.artifactId as string | undefined;

      const artifact = artifactId
        ? store.getState().artifacts.config.itemsById[artifactId]
        : null;
      const artifactType = artifact?.type;

      const artifactMeta = artifactType
        ? ARTIFACT_TYPES[artifactType as keyof typeof ARTIFACT_TYPES]
        : undefined;

      if (!artifactMeta) {
        return {
          component: () => null,
          title: `Unknown panel ${artifactId}`,
          icon: LayoutDashboardIcon,
        };
      }

      return {
        component: artifactMeta.component,
        title: artifact?.title || `New ${artifactMeta.title}`,
        icon: artifactMeta.icon,
      };
    },
  },
});
