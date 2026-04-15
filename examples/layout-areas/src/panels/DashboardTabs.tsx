import {
  extractPanelId,
  getLayoutNodeId,
  RoomPanelComponent,
  TabsLayout,
} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {useCallback} from 'react';
import {PlusIcon} from 'lucide-react';

export const DashboardTabs: RoomPanelComponent = ({node}) => {
  const addChartToDashboard = useRoomStore((s) => s.addChartToDashboard);
  const getActiveTab = useRoomStore((s) => s.layout.getActiveTab);

  const handleAddChart = useCallback(() => {
    const activeTabId = getActiveTab(getLayoutNodeId(node));
    if (!activeTabId) {
      return;
    }

    addChartToDashboard(extractPanelId(activeTabId));
  }, [getActiveTab, addChartToDashboard, node]);

  return (
    <>
      <TabsLayout.TabStrip closeable={true} preventCloseLastTab={false}>
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
        <TabsLayout.NewButton />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <div className="my-1 flex justify-end gap-2 p-1">
          <Button variant="default" onClick={handleAddChart}>
            <PlusIcon /> Add Chart
          </Button>
        </div>
        <TabsLayout.TabContent />
      </TabsLayout.TabContentContainer>
    </>
  );
};
