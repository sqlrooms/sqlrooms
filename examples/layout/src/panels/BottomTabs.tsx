import {RoomPanelComponent, TabsLayout} from '@sqlrooms/layout';

export const BottomTabs: RoomPanelComponent = () => {
  return (
    <>
      <TabsLayout.TabStrip
        closeable={true}
        preventCloseLastTab={false}
        className="pb-2"
      >
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
        <TabsLayout.NewButton />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <TabsLayout.TabContent />
      </TabsLayout.TabContentContainer>
    </>
  );
};
