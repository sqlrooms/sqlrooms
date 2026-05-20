import {FC, PropsWithChildren} from 'react';
import {LayoutNode} from '@sqlrooms/layout-config';
import {ResizablePanelGroup} from '@sqlrooms/ui';
import {useSplitNodeContext} from '../../LayoutNodeContext';

export type RenderPanelProps = {
  node: LayoutNode;
  nodeIndex: number;
};

export const SplitLayoutPanelGroup: FC<PropsWithChildren> = ({children}) => {
  const {node: parentNode} = useSplitNodeContext();

  const orientation =
    parentNode.direction === 'column' ? 'vertical' : 'horizontal';

  return (
    <ResizablePanelGroup orientation={orientation}>
      {children}
    </ResizablePanelGroup>
  );
};
