import {
  RoomPanelComponent,
  TabsLayout,
  useLayoutNodeContext,
} from '@sqlrooms/layout';
import {PivotView} from '@sqlrooms/pivot';
import {Button} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {useCallback, useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';

export const MainView: RoomPanelComponent = () => {
  const ctx = useLayoutNodeContext();
  const tabsId = ctx.containerType === 'tabs' ? ctx.node.id : undefined;
  const pivotConfig = useRoomStore((state) => state.pivot.config);
  const addPivot = useRoomStore((state) => state.pivot.addPivot);
  const removePivot = useRoomStore((state) => state.pivot.removePivot);
  const addTab = useRoomStore((state) => state.layout.addTab);
  const removeTab = useRoomStore((state) => state.layout.removeTab);
  const getTabs = useRoomStore((state) => state.layout.getTabs);
  const reorderTabs = useRoomStore((state) => state.layout.reorderTabs);
  const layoutConfig = useRoomStore((state) => state.layout.config);

  const pivotOrder = pivotConfig.pivotOrder;
  const fallbackPivotId = pivotOrder[0];
  const existingTabIds = useMemo(
    () => (tabsId ? getTabs(tabsId) : []),
    [getTabs, layoutConfig, tabsId],
  );

  useEffect(() => {
    if (!tabsId) return;

    let didMutateLayout = false;

    for (const pivotId of pivotOrder) {
      if (existingTabIds.includes(pivotId)) continue;
      didMutateLayout = true;
      addTab(tabsId, {
        type: 'panel',
        id: pivotId,
        panel: {
          key: 'pivot',
          meta: {pivotId},
        },
      });
    }

    for (const tabId of existingTabIds) {
      if (!pivotConfig.pivots[tabId]) {
        didMutateLayout = true;
        removeTab(tabsId, tabId);
      }
    }

    const orderedVisibleTabs = pivotOrder.filter((pivotId) =>
      existingTabIds.includes(pivotId),
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
    existingTabIds,
    pivotConfig.pivots,
    pivotOrder,
    removeTab,
    reorderTabs,
    tabsId,
  ]);

  const handleAddPivot = useCallback(() => {
    addPivot();
  }, [addPivot]);

  const handleClosePivot = useCallback(
    (pivotId: string) => {
      removePivot(pivotId);
    },
    [removePivot],
  );

  if (ctx.containerType !== 'tabs') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 py-3">
          <Button size="sm" variant="secondary" onClick={handleAddPivot}>
            <PlusIcon className="h-4 w-4" /> Add pivot
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {fallbackPivotId ? <PivotView pivotId={fallbackPivotId} /> : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <TabsLayout.TabStrip
        closeable={true}
        preventCloseLastTab={false}
        onClose={handleClosePivot}
      >
        <TabsLayout.Tabs />
        <TabsLayout.NewButton onClick={handleAddPivot} />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <TabsLayout.TabContent />
        {pivotOrder.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Button onClick={handleAddPivot}>
              <PlusIcon className="h-4 w-4" /> Add pivot
            </Button>
          </div>
        ) : null}
      </TabsLayout.TabContentContainer>
    </>
  );
};
