import {LayoutTabsNode as LayoutTabsNodeType} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {LayoutPath} from '../../types';
import {TabsLayoutProvider} from './TabsLayoutProvider';
import {TabsLayoutTabStrip} from './TabsLayoutTabStrip';
import {TabsLayoutTabContent} from './TabsLayoutTabContent';
import {ParentDirection} from '../types';
import {RendererSwitcher} from '../RendererSwitcher';
import {TabStrip} from '@sqlrooms/ui';
import {TabsLayoutTabContentContainer} from './TabsLayoutTabContentContainer';

interface NodeProps {
  node: LayoutTabsNodeType;
  path: LayoutPath;
  parentDirection: ParentDirection | undefined;
}

const Root: FC<NodeProps> = ({node, path, parentDirection}) => {
  const defaultComponent = (
    <>
      <TabsLayout.TabStrip>
        <TabsLayout.Tabs />
      </TabsLayout.TabStrip>
      <TabsLayoutTabContentContainer>
        <TabsLayoutTabContent />
      </TabsLayoutTabContentContainer>
    </>
  );

  return (
    <TabsLayoutProvider
      node={node}
      path={path}
      parentDirection={parentDirection}
    >
      <div className="relative flex h-full w-full flex-col">
        <RendererSwitcher
          node={node}
          path={path}
          defaultComponent={defaultComponent}
        />
      </div>
    </TabsLayoutProvider>
  );
};

export const TabsLayout = {
  Root,
  TabStrip: TabsLayoutTabStrip,
  TabContentContainer: TabsLayoutTabContentContainer,
  TabContent: TabsLayoutTabContent,
  SearchDropdown: TabStrip.SearchDropdown,
  Tabs: TabStrip.Tabs,
  NewButton: TabStrip.NewButton,
};
