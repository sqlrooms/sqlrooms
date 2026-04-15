import {FC, useCallback} from 'react';
import {CollapseButton} from '../CollapseButton';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {useTabsNodeContext} from '../../LayoutNodeContext';
import {ExpandButton} from '../ExpandButton';

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
    <>
      {collapsed ? (
        <ExpandButton direction={parentDirection} onClick={handleExpand} />
      ) : (
        <CollapseButton onClick={handleCollapse} />
      )}
    </>
  );
};
