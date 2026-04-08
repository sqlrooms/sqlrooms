import {LayoutTabsNode as LayoutTabsNodeType} from '@sqlrooms/layout-config';
import {FC, PropsWithChildren} from 'react';
import {LayoutPath} from '../../types';
import {TabsLayoutRendererProvider} from './TabsLayoutRendererContext';
import {CollapsedTabStrip} from './CollapsedTabStrip';
import {ExpandedTabStrip} from './ExpandedTabStrip';
import {TabContent} from './TabContent';
import {useTabsLayoutRendererContext} from './TabsLayoutRendererContext';
import {ParentDirection} from '../types';
import {RendererSwitcher} from '../RendererSwitcher';

interface NodeProps {
  node: LayoutTabsNodeType;
  path: LayoutPath;
  parentDirection: ParentDirection | undefined;
}

const TabStrip: FC = () => {
  const {node} = useTabsLayoutRendererContext();

  if (node.collapsed) {
    return <CollapsedTabStrip />;
  }

  return <ExpandedTabStrip />;
};

const Content: FC = () => {
  const {node} = useTabsLayoutRendererContext();

  if (node.collapsed) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1">
      <TabContent />
    </div>
  );
};

const Root: FC<NodeProps> = ({node, path, parentDirection}) => {
  return (
    <TabsLayoutRendererProvider
      node={node}
      path={path}
      parentDirection={parentDirection}
    >
      <div className="relative flex h-full w-full flex-col">
        <RendererSwitcher node={node} path={path}>
          <TabsLayoutRenderer.TabStrip />
          <TabsLayoutRenderer.TabContent />
        </RendererSwitcher>
      </div>
    </TabsLayoutRendererProvider>
  );
};

export const TabsLayoutRenderer = {
  Root,
  TabStrip,
  TabContent: Content,
};
