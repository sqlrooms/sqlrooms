import {ResizablePanel} from '@sqlrooms/ui';
import {FC, PropsWithChildren, useCallback, useEffect, useRef} from 'react';
import {
  type PanelImperativeHandle,
  type PanelSize,
} from 'react-resizable-panels';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {LayoutNodeSize} from '@sqlrooms/layout-config';

/**
 * Ensures react-resizable-panels snaps between collapsed and expanded
 * states instead of allowing intermediate sizes.
 */
const DEFAULT_COLLAPSIBLE_MIN_SIZE = '10%';

export type CollapsiblePanelWrapperProps = {
  panelId: string;
  collapsed: boolean;
  onResize?: (
    panelSize: PanelSize,
    id: string | number | undefined,
    prevPanelSize: PanelSize | undefined,
  ) => void;
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
  onResize,
  children,
}) => {
  const {onCollapse, onExpand} = useLayoutRendererContext();

  const panelRef = useRef<PanelImperativeHandle | null>(null);

  // Reconcile the imperative RRP handle to the declared `collapsed` state.
  // This must be a passive effect (not layout): it runs after the RRP Group has
  // registered itself, otherwise `handle.isCollapsed()` throws "Group not
  // found". The correct *initial* frame is seeded declaratively via the group's
  // `defaultLayout`, so this effect only needs to keep subsequent programmatic
  // collapse/expand changes in sync.
  useEffect(() => {
    const handle = panelRef.current;

    if (!handle) {
      return;
    }

    if (collapsed && !handle.isCollapsed()) {
      handle.collapse();
    } else if (!collapsed && handle.isCollapsed()) {
      // Prefer resizing straight to the declared `defaultSize` over `expand()`.
      // `expand()` restores the panel's most-recent size, which can be nearly
      // the whole group (e.g. an assistant that was full-width before being
      // collapsed); that synchronously starves a visible sibling below its
      // `minSize` and trips RRP's auto-collapse, hiding it. `resize()` un-
      // collapses to an explicit, bounded width in one step (and `defaultSize`
      // also carries the last user-set width, see SplitLayoutPanelGroup).
      if (defaultSize != null) {
        handle.resize(defaultSize);
      } else {
        handle.expand();
      }
    }
    // `defaultSize` is intentionally omitted: we only re-apply it on the
    // collapsed → expanded transition, driven by `collapsed`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const handleResize = useCallback(
    (
      panelSize: PanelSize,
      id: string | number | undefined,
      prevPanelSize: PanelSize | undefined,
    ) => {
      const handle = panelRef.current;

      if (!panelId || !handle) {
        return;
      }

      if (collapsed && !handle.isCollapsed()) {
        onExpand?.(panelId);
      } else if (!collapsed && handle.isCollapsed()) {
        onCollapse?.(panelId);
      }

      onResize?.(panelSize, id, prevPanelSize);
    },
    [panelId, collapsed, onExpand, onCollapse, onResize],
  );

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
