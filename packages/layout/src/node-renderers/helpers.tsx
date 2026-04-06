import {Button, ResizablePanel} from '@sqlrooms/ui';
import {ChevronsRightIcon, ChevronsUpIcon, XIcon} from 'lucide-react';
import React, {FC, useCallback, useEffect, useRef} from 'react';
import {
  type PanelImperativeHandle,
  type PanelSize,
} from 'react-resizable-panels';

// ---------------------------------------------------------------------------
// CollapsiblePanelWrapper – used by SplitRenderer
// ---------------------------------------------------------------------------

/**
 * Ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

export const CollapsiblePanelWrapper: FC<{
  id: string;
  collapsed: boolean;
  collapsible: boolean;
  collapsedSize?: number | string;
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  areaId?: string;
  onExpand?: (areaId: string, panelId?: string) => void;
  onCollapse?: (areaId: string) => void;
  children: React.ReactNode;
}> = ({
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
    if (!handle) return;
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
      if (!areaId) return;
      const handle = panelRef.current;
      if (!handle) return;
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

// ---------------------------------------------------------------------------
// CollapseButton / ExpandButton – used by TabsRenderer
// ---------------------------------------------------------------------------

export function CollapseButton({onClick}: {onClick: () => void}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Collapse"
    >
      <XIcon className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ExpandButton({
  direction,
  onClick,
}: {
  direction?: 'row' | 'column';
  onClick: () => void;
}) {
  const Icon =
    direction === 'column'
      ? ChevronsUpIcon
      : direction === 'row'
        ? ChevronsRightIcon
        : ChevronsRightIcon;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hover:bg-primary/10 h-7 w-7 shrink-0"
      onClick={onClick}
      aria-label="Expand"
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
