import {
  RoomPanelComponent,
  TabsLayout,
  useLayoutNodeContext,
} from '@sqlrooms/layout';
import {Notebook} from '@sqlrooms/notebook';
import {Button} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {NotebookPanel} from './NotebookPanel';
import {useRoomStore} from '../store';

export const MainView: RoomPanelComponent = () => {
  const ctx = useLayoutNodeContext();
  const tabsId = ctx.containerType === 'tabs' ? ctx.node.id : undefined;
  const artifactsConfig = useRoomStore((state) => state.artifacts.config);
  const addItem = useRoomStore((state) => state.artifacts.addItem);
  const renameItem = useRoomStore((state) => state.artifacts.renameItem);
  const setCurrentItem = useRoomStore(
    (state) => state.artifacts.setCurrentItem,
  );
  const removeItem = useRoomStore((state) => state.artifacts.removeItem);
  const addTab = useRoomStore((state) => state.layout.addTab);
  const removeTab = useRoomStore((state) => state.layout.removeTab);
  const getTabs = useRoomStore((state) => state.layout.getTabs);
  const getActiveTab = useRoomStore((state) => state.layout.getActiveTab);
  const reorderTabs = useRoomStore((state) => state.layout.reorderTabs);
  const registerPanel = useRoomStore((state) => state.layout.registerPanel);
  const unregisterPanel = useRoomStore((state) => state.layout.unregisterPanel);
  const layoutConfig = useRoomStore((state) => state.layout.config);
  const ensureArtifact = useRoomStore((state) => state.notebook.ensureArtifact);
  const removeArtifact = useRoomStore((state) => state.notebook.removeArtifact);

  const artifactOrder = useMemo(
    () =>
      artifactsConfig.order.filter(
        (artifactId) =>
          artifactsConfig.itemsById[artifactId]?.type === 'notebook',
      ),
    [artifactsConfig.itemsById, artifactsConfig.order],
  );
  const fallbackArtifactId = artifactOrder[0];
  const registeredArtifactIdsRef = useRef<Set<string>>(new Set());
  const existingTabIds = useMemo(
    () => (tabsId ? getTabs(tabsId) : []),
    [getTabs, layoutConfig, tabsId],
  );
  const activeTabId = tabsId ? getActiveTab(tabsId) : undefined;

  useEffect(() => {
    if (activeTabId) {
      setCurrentItem(activeTabId);
    }
  }, [activeTabId, setCurrentItem]);

  useEffect(() => {
    const nextArtifactIds = new Set(artifactOrder);

    for (const artifactId of registeredArtifactIdsRef.current) {
      if (!nextArtifactIds.has(artifactId)) {
        unregisterPanel(artifactId);
      }
    }

    for (const artifactId of artifactOrder) {
      const artifact = artifactsConfig.itemsById[artifactId];
      if (!artifact) continue;
      registerPanel(artifactId, {
        title: artifact.title,
        icon: () => null,
        component: NotebookPanel,
      });
    }

    registeredArtifactIdsRef.current = nextArtifactIds;
  }, [
    artifactOrder,
    artifactsConfig.itemsById,
    registerPanel,
    unregisterPanel,
  ]);

  useEffect(() => {
    return () => {
      for (const artifactId of registeredArtifactIdsRef.current) {
        unregisterPanel(artifactId);
      }
      registeredArtifactIdsRef.current = new Set();
    };
  }, [unregisterPanel]);

  useEffect(() => {
    if (!tabsId) return;

    let didMutateLayout = false;

    for (const artifactId of artifactOrder) {
      if (existingTabIds.includes(artifactId)) continue;
      didMutateLayout = true;
      addTab(tabsId, {
        type: 'panel',
        id: artifactId,
        panel: {
          key: artifactId,
          meta: {artifactId},
        },
      });
    }

    for (const tabId of existingTabIds) {
      if (!artifactsConfig.itemsById[tabId]) {
        didMutateLayout = true;
        removeTab(tabsId, tabId);
      }
    }

    const orderedVisibleTabs = artifactOrder.filter((artifactId) =>
      existingTabIds.includes(artifactId),
    );
    const sameVisibleOrder =
      orderedVisibleTabs.length === existingTabIds.length &&
      orderedVisibleTabs.every(
        (tabId, index) => existingTabIds[index] === tabId,
      );

    if (
      !didMutateLayout &&
      orderedVisibleTabs.length > 0 &&
      !sameVisibleOrder
    ) {
      reorderTabs(tabsId, orderedVisibleTabs);
    }
  }, [
    addTab,
    artifactOrder,
    artifactsConfig.itemsById,
    existingTabIds,
    removeTab,
    reorderTabs,
    tabsId,
  ]);

  const handleAddNotebook = useCallback(() => {
    const artifactId = addItem({
      type: 'notebook',
      title: 'Notebook',
    });
    ensureArtifact(artifactId);
  }, [addItem, ensureArtifact]);

  const handleCloseNotebook = useCallback(
    (artifactId: string) => {
      removeArtifact(artifactId);
      removeItem(artifactId);
    },
    [removeArtifact, removeItem],
  );

  const handleRenameNotebook = useCallback(
    (artifactId: string, title: string) => {
      renameItem(artifactId, title);
    },
    [renameItem],
  );

  if (ctx.containerType !== 'tabs') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 py-3">
          <Button size="sm" variant="secondary" onClick={handleAddNotebook}>
            <PlusIcon className="h-4 w-4" /> Add notebook
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {fallbackArtifactId ? (
            <Notebook artifactId={fallbackArtifactId} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <TabsLayout.TabStrip
        closeable={true}
        preventCloseLastTab={false}
        onClose={handleCloseNotebook}
        onRename={handleRenameNotebook}
      >
        <TabsLayout.Tabs />
        <TabsLayout.NewButton onClick={handleAddNotebook} />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <TabsLayout.TabContent />
        {artifactOrder.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Button onClick={handleAddNotebook}>
              <PlusIcon className="h-4 w-4" /> Add notebook
            </Button>
          </div>
        ) : null}
      </TabsLayout.TabContentContainer>
    </>
  );
};
