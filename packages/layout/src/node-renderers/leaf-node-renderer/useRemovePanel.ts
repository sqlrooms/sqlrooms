import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {useCallback} from 'react';
import {useDockingContext} from '../../docking/DockingContext';
import {removeLayoutNodeByKey} from '../../layout-tree';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {useLayoutRendererContext} from '../../LayoutRendererContext';

type RemovePanelHandler = (e: React.MouseEvent) => void;

export function useRemovePanelHandler(): RemovePanelHandler {
  const {node} = useLayoutNodeContext();

  const panelId = getLayoutNodeId(node);
  const {rootLayout} = useDockingContext();

  const {onLayoutChange} = useLayoutRendererContext();

  return useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onLayoutChange) return;

      const result = removeLayoutNodeByKey(rootLayout, panelId);
      if (result.success) {
        onLayoutChange(result.nextTree);
      }
    },
    [onLayoutChange, rootLayout, panelId],
  );
}
