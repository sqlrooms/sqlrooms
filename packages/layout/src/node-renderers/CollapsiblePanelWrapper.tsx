import {ResizablePanel} from '@sqlrooms/ui';
import {FC, PropsWithChildren, useCallback, useEffect, useRef} from 'react';
import {
  type PanelImperativeHandle,
  type PanelSize,
} from 'react-resizable-panels';

/**
 * Ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

export type CollapsiblePanelWrapperProps = {
  id: string;
  collapsed: boolean;
  collapsible?: boolean;
  collapsedSize?: number | string;
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  areaId?: string;
  onExpand?: (areaId: string, panelId?: string) => void;
  onCollapse?: (areaId: string) => void;
};

export const CollapsiblePanelWrapper: FC<
  PropsWithChildren<CollapsiblePanelWrapperProps>
> = ({
  id,
  collapsed,
  collapsible,
  collapsedSize,
  defaultSize,
  minSize,
  maxSize,
  areaId,
  onExpand,
  onCollapse,
  children,
}) => {
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

  const handleResize = useCallback(
    (
      _panelSize: PanelSize,
      _id: string | number | undefined,
      _prevSize: PanelSize | undefined,
    ) => {
      const handle = panelRef.current;

      if (!areaId || !handle) {
        return;
      }

      if (collapsed && !handle.isCollapsed()) {
        onExpand?.(areaId);
      } else if (!collapsed && handle.isCollapsed()) {
        onCollapse?.(areaId);
      }
    },
    [areaId, collapsed, onExpand, onCollapse],
  );

  const effectiveMinSize =
    minSize ?? (collapsible ? DEFAULT_COLLAPSIBLE_MIN_SIZE : undefined);

  return (
    <ResizablePanel
      id={id}
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
