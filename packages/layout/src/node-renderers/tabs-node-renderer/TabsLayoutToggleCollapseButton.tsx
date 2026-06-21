import {FC, useCallback} from 'react';
import {TooltipProvider} from '@sqlrooms/ui';
import {CollapseButton} from './CollapseButton';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {useTabsNodeContext} from '../../LayoutNodeContext';
import {ExpandButton} from './ExpandButton';

export const TabsLayoutToggleCollapseButton: FC = () => {
  const {
    node: {id: panelId, collapsed},
    parentDirection,
  } = useTabsNodeContext();

  const {onCollapse, onExpand} = useLayoutRendererContext();

  const handleCollapse = useCallback(() => {
    onCollapse?.(panelId);
  }, [panelId, onCollapse]);

  const handleExpand = useCallback(() => {
    onExpand?.(panelId);
  }, [panelId, onExpand]);

  return (
    <TooltipProvider delayDuration={300}>
      {collapsed ? (
        <ExpandButton direction={parentDirection} onClick={handleExpand} />
      ) : (
        <CollapseButton onClick={handleCollapse} />
      )}
    </TooltipProvider>
  );
};
