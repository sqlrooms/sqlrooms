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

      const artifactSheet = artifactId
        ? store.getState().cells.config.sheets[artifactId]
        : null;
      const artifactType = artifactSheet?.type;

      const artifactMeta = artifactType
        ? ARTIFACT_TYPES[artifactType]
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
        title: artifactSheet?.title || `New ${artifactMeta.title}`,
        icon: artifactMeta.icon,
      };
    },
  },
});
