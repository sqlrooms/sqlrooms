import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {useDockingContext} from '../../docking/DockingContext';
import {isDockablePanel} from '../../layout-tree';
import {useLayoutNodeContext} from '../../LayoutNodeContext';

export function useIsDockablePanel(): boolean {
  const {node} = useLayoutNodeContext();

  const panelId = getLayoutNodeId(node);
  const {rootLayout} = useDockingContext();

  return isDockablePanel(rootLayout, panelId);
}
