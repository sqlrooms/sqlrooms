import {FC} from 'react';
import {LayoutNodeKey, LayoutPanelNode} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {PanelContainerType} from '../../layout-base-types';
import {LeafLayoutDragHandle} from './LeafLayoutDragHandle';
import {LeafLayoutPanel} from './LeafLayoutPanel';
import {LeafLayoutHeader} from './LeafLayoutHeader';

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
  parentContainerType?: PanelContainerType;
  parentContainerId?: string;
}

const Root: FC<RootProps> = ({
  node,
  path,
  parentContainerType,
  parentContainerId,
}) => {
  return (
    <LayoutNodeProvider
      containerType="leaf"
      node={node}
      path={path}
      parentContainerType={parentContainerType}
      parentContainerId={parentContainerId}
    >
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
