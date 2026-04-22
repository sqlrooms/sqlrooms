import {FC} from 'react';
import {
  getLayoutNodeId,
  LayoutNodeKey,
  LayoutPanelNode,
} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {useGetPanel} from '../../useGetPanel';
import {LeafLayoutDragHandle} from './LeafLayoutDragHandle';
import {LeafLayoutContent} from './LeafLayoutContent';
import {LeafLayoutPanel} from './LeafLayoutPanel';
import {LeafLayoutHeader} from './LeafLayoutHeader';

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
}

const Root: FC<RootProps> = ({node, path}) => {
  const panelId = getLayoutNodeId(node);
  const panelInfo = useGetPanel(node);
  const title = panelInfo?.title ?? panelId;

  return (
    <LayoutNodeProvider containerType="leaf" node={node} path={path}>
      <LeafLayout.Panel>
        <LeafLayout.Header title={title} />
        <LeafLayout.Content>
          <RendererSwitcher />
        </LeafLayout.Content>
      </LeafLayout.Panel>
    </LayoutNodeProvider>
  );
};

export const LeafLayout = {
  Root,
  Panel: LeafLayoutPanel,
  Header: LeafLayoutHeader,
  DragHandle: LeafLayoutDragHandle,
  Content: LeafLayoutContent,
};
