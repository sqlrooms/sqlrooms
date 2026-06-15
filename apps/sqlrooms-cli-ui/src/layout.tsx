import {createArtifactPanelDefinition} from '@sqlrooms/artifacts';
import {
  CreateLayoutSliceProps,
  getLayoutNodeId,
  isLayoutSplitNode,
  type LayoutConfig,
} from '@sqlrooms/layout';
import {FolderIcon, SparklesIcon} from 'lucide-react';
import {StoreApi} from 'zustand';
import {ARTIFACT_TYPES} from './artifactTypes';
import {AssistantPanel} from './components/AssistantPanel';
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
      {
        type: 'tabs',
        id: 'workspace',
        panel: 'workspace',
        defaultSize: '70%',
        children: [],
        activeTabIndex: 0,
      },
    ],
  },
  panels: {
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
    artifact: createArtifactPanelDefinition(ARTIFACT_TYPES, store),
  },
});

export function migrateCliLayoutConfig(config: LayoutConfig): LayoutConfig {
  if (!isLayoutSplitNode(config)) {
    return config;
  }

  const children = config.children.filter(
    (child) => getLayoutNodeId(child) !== 'left-sidebar',
  );
  const assistantNode = children.find(
    (child) => getLayoutNodeId(child) === 'assistant-sidebar',
  );
  if (!assistantNode) {
    return {
      ...config,
      children,
    };
  }

  const childrenWithoutAssistant = children.filter(
    (child) => getLayoutNodeId(child) !== 'assistant-sidebar',
  );
  const workspaceIndex = childrenWithoutAssistant.findIndex(
    (child) => getLayoutNodeId(child) === 'workspace',
  );

  if (workspaceIndex === -1) {
    return {
      ...config,
      children,
    };
  }

  const reorderedChildren = [...childrenWithoutAssistant];
  reorderedChildren.splice(workspaceIndex, 0, assistantNode);

  return {
    ...config,
    children: reorderedChildren,
  };
}
