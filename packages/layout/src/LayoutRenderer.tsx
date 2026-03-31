import {LayoutNode} from '@sqlrooms/layout-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import type {RoomPanelInfo, TabStripRenderContext} from './LayoutSlice';
import {NodeRenderer} from './node-renderers/NodeRenderer';

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface LayoutRendererProps {
  layout: LayoutNode | null;
  panels: Record<string, RoomPanelInfo>;
  className?: string;
  renderTabStrip?: (
    context: TabStripRenderContext,
  ) => React.ReactNode | undefined;
  onLayoutChange?: (layout: LayoutNode | null) => void;
  onTabSelect?: (tabsId: string, tabId: string) => void;
  onTabClose?: (tabsId: string, tabId: string) => void;
  onTabReorder?: (tabsId: string, tabIds: string[]) => void;
  onTabCreate?: (tabsId: string) => void;
  onCollapse?: (id: string) => void;
  onExpand?: (id: string, tabId?: string) => void;
}

// ---------------------------------------------------------------------------
// Main LayoutRenderer
// ---------------------------------------------------------------------------

const LayoutRenderer: FC<LayoutRendererProps> = ({
  layout,
  panels,
  className,
  renderTabStrip,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onCollapse,
  onExpand,
}) => {
  if (!layout) return null;

  return (
    <div className={cn('h-full min-w-0 flex-1', className)}>
      <NodeRenderer
        node={layout}
        path={[]}
        containerType="root"
        panels={panels}
        rootLayout={layout}
        renderTabStrip={renderTabStrip}
        onLayoutChange={onLayoutChange}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        onTabReorder={onTabReorder}
        onTabCreate={onTabCreate}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    </div>
  );
};

export default LayoutRenderer;
