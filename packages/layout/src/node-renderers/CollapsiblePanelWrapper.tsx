import {ResizablePanel} from '@sqlrooms/ui';
import {FC, PropsWithChildren, useCallback, useEffect, useRef} from 'react';
import {type PanelImperativeHandle} from 'react-resizable-panels';
import {useLayoutRendererContext} from '../LayoutRendererContext';
import {LayoutNodeSize} from '@sqlrooms/layout-config';

/**
 * Ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

export type CollapsiblePanelWrapperProps = {
  panelId: string;
  collapsed: boolean;
} & LayoutNodeSize;

export const CollapsiblePanelWrapper: FC<
  PropsWithChildren<CollapsiblePanelWrapperProps>
> = ({
  panelId,
  collapsed,
  collapsible,
  collapsedSize,
  defaultSize,
  minSize,
  maxSize,
  children,
}) => {
  const {onCollapse, onExpand} = useLayoutRendererContext();

  const panelRef = useRef<PanelImperativeHandle | null>(null);

  useEffect(() => {
    const handle = panelRef.current;

    if (!handle) {
      return;
    }

    if (collapsed && !handle.isCollapsed()) {
      handle.collapse();
    } else if (!collapsed && handle.isCollapsed()) {
      handle.expand();
    }
  }, [collapsed]);

  const handleResize = useCallback(() => {
    const handle = panelRef.current;

    if (!panelId || !handle) {
      return;
    }

    if (collapsed && !handle.isCollapsed()) {
      onExpand?.(panelId);
    } else if (!collapsed && handle.isCollapsed()) {
      onCollapse?.(panelId);
    }
  }, [panelId, collapsed, onExpand, onCollapse]);

  const effectiveMinSize =
    minSize ?? (collapsible ? DEFAULT_COLLAPSIBLE_MIN_SIZE : undefined);

  return (
    <ResizablePanel
      id={panelId}
      panelRef={panelRef}
      collapsible={collapsible}
      collapsedSize={collapsedSize ?? 0}
      defaultSize={defaultSize}
      minSize={effectiveMinSize}
      maxSize={maxSize}
      onResize={handleResize}
    >
      {children}
    </ResizablePanel>
  );
};
