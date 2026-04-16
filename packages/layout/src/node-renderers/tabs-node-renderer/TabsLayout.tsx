import {LayoutTabsNode as LayoutTabsNodeType} from '@sqlrooms/layout-config';
import {FC} from 'react';
import {LayoutPath, ParentDirection} from '../../types';
import {TabsLayoutTabStrip} from './TabsLayoutTabStrip';
import {TabsLayoutTabContent} from './TabsLayoutTabContent';
import {RendererSwitcher} from '../RendererSwitcher';
import {TabStrip} from '@sqlrooms/ui';
import {TabsLayoutTabContentContainer} from './TabsLayoutTabContentContainer';
import {LayoutNodeProvider} from '../../LayoutNodeContext';

interface NodeProps {
  node: LayoutTabsNodeType;
  path: LayoutPath;
  parentDirection: ParentDirection | undefined;
}

const Root: FC<NodeProps> = ({node, path, parentDirection}) => {
  const defaultComponent = (
    <>
      {!node.hideTabStrip && (
        <TabsLayout.TabStrip>
          <TabsLayout.Tabs />
        </TabsLayout.TabStrip>
      )}
      <TabsLayoutTabContentContainer>
        <TabsLayoutTabContent />
      </TabsLayoutTabContentContainer>
    </>
  );

  return (
    <LayoutNodeProvider
      containerType="tabs"
      node={node}
      path={path}
      parentDirection={parentDirection}
    >
      <div className="relative flex h-full w-full flex-col">
        <RendererSwitcher path={path} defaultComponent={defaultComponent} />
      </div>
    </LayoutNodeProvider>
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
