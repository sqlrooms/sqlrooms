import {
  extractPanelId,
  RoomPanelComponent,
  TabsLayoutRenderer,
  useTabsLayoutRendererContext,
} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {useCallback} from 'react';

export const DashboardTabs: RoomPanelComponent = () => {
  const {activeTabId} = useTabsLayoutRendererContext();

  const addChartToDashboard = useRoomStore((s) => s.addChartToDashboard);

  const handleAddChart = useCallback(() => {
    if (!activeTabId) {
      return;
    }

    addChartToDashboard(extractPanelId(activeTabId));
  }, [addChartToDashboard, activeTabId]);

  return (
    <>
      <TabsLayoutRenderer.TabStrip />
      <div className="flex h-full w-full flex-col overflow-hidden p-2">
        <div>
          <Button variant="ghost" onClick={handleAddChart}>
            Add Chart
          </Button>
        </div>

        <TabsLayoutRenderer.TabContent />
      </div>
    </>
  );
};
