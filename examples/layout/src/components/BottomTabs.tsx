import {TabsLayout} from '@sqlrooms/layout';
import {FC} from 'react';

export const BottomTabs: FC = () => (
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
