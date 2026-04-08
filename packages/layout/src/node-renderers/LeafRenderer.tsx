import {FC} from 'react';
import {NodeRenderProps} from './types';
import {LayoutNodeKey} from '@sqlrooms/layout-config';
import {RendererSwitcher} from './RendererSwitcher';

export const LeafRenderer: FC<NodeRenderProps<LayoutNodeKey>> = ({
  node,
  path,
}) => {
  return (
    <div className="h-full w-full overflow-hidden p-2">
      <RendererSwitcher node={node} path={path} />
    </div>
  );
};
