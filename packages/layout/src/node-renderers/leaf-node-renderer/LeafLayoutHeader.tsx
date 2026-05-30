import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {FC, PropsWithChildren, useMemo} from 'react';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useIsDockablePanel} from './useIsDockable';

export const LeafLayoutHeader: FC<PropsWithChildren> = ({children}) => {
  const context = useLayoutNodeContext();
  const {node} = context;
  const isDockable = useIsDockablePanel();
  const nodeId = getLayoutNodeId(node);
  const layout = useStoreWithLayout((state) => state.layout);
  const gridAncestor = useMemo(
    () => layout.findAncestorOfType(nodeId, 'grid'),
    [layout, nodeId],
  );
  const isGridChild =
    context.containerType === 'leaf' && context.parentContainerType === 'grid';

  if (!isDockable && !gridAncestor && !isGridChild) {
    return null;
  }

  return children;
};
