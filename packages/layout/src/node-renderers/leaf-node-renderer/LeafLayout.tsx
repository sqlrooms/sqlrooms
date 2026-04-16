import {FC} from 'react';
import {LayoutNodeKey, LayoutPanelNode} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
}

export const Root: FC<RootProps> = ({node, path}) => {
  return (
    <LayoutNodeProvider containerType="leaf" node={node} path={path}>
      <div className="h-full w-full overflow-hidden p-2">
        <RendererSwitcher path={path} />
      </div>
    </LayoutNodeProvider>
  );
};

export const LeafLayout = {
  Root,
};
