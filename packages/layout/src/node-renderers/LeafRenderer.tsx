import {FC} from 'react';
import {NodeRenderProps} from './types';
import {LayoutNodeKey} from '@sqlrooms/layout-config';
import {RendererSwitcher} from './RendererSwitcher';
import {LayoutNodeProvider} from '../LayoutNodeContext';

export const LeafRenderer: FC<NodeRenderProps<LayoutNodeKey>> = ({
  node,
  path,
}) => {
  return (
    <LayoutNodeProvider containerType="leaf" node={node} path={path}>
      <div className="h-full w-full overflow-hidden p-2">
        <RendererSwitcher node={node} path={path} />
      </div>
    </LayoutNodeProvider>
  );
};
