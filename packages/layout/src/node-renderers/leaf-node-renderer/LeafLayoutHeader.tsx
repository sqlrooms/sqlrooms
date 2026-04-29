import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {FC, PropsWithChildren} from 'react';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {useStoreWithLayout} from '../../LayoutSlice';
import {useIsDockablePanel} from './useIsDockable';

export const LeafLayoutHeader: FC<PropsWithChildren> = ({children}) => {
  const {node} = useLayoutNodeContext();
  const isDockable = useIsDockablePanel();
  const nodeId = getLayoutNodeId(node);
  const gridAncestor = useStoreWithLayout((state) =>
    state.layout.findAncestorOfType(nodeId, 'grid'),
  );

  if (!isDockable && !gridAncestor) {
    return null;
  }

  return children;
};
