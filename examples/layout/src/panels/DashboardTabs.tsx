import {extractPanelId, RoomPanelComponent, TabsLayout} from '@sqlrooms/layout';
import {Button} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {useCallback} from 'react';
import {useRoomStore} from '../store';

export const DashboardTabs: RoomPanelComponent = ({panelInfo: {panelId}}) => {
  const addChartToDashboard = useRoomStore((s) => s.addChartToDashboard);
  const getActiveTab = useRoomStore((s) => s.layout.getActiveTab);

  const handleAddChart = useCallback(() => {
    const activeTabId = getActiveTab(panelId);
    if (!activeTabId) {
      return;
    }

    addChartToDashboard(extractPanelId(activeTabId));
  }, [getActiveTab, addChartToDashboard, panelId]);

  return (
    <>
      <TabsLayout.TabStrip closeable={true} preventCloseLastTab={false}>
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
        <TabsLayout.NewButton />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <div className="my-1 flex shrink-0 justify-end gap-2 p-1">
          <Button variant="default" onClick={handleAddChart}>
            <PlusIcon /> Add Chart
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsLayout.TabContent />
        </div>
      </TabsLayout.TabContentContainer>
    </>
  );
};
