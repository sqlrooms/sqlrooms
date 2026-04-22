import {FC} from 'react';
import {LayoutNodeKey, LayoutPanelNode} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {LeafLayoutDragHandle} from './LeafLayoutDragHandle';
import {LeafLayoutPanel} from './LeafLayoutPanel';
import {LeafLayoutHeader} from './LeafLayoutHeader';

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
}

const Root: FC<RootProps> = ({node, path}) => {
  return (
    <LayoutNodeProvider containerType="leaf" node={node} path={path}>
      <LeafLayoutPanel>
        <RendererSwitcher />
      </LeafLayoutPanel>
    </LayoutNodeProvider>
  );
};

export const LeafLayout = {
  Root,
  Header: LeafLayoutHeader,
  DragHandle: LeafLayoutDragHandle,
};
