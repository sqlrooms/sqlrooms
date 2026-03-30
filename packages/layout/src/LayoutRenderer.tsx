import {LayoutNode} from '@sqlrooms/layout-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import type {
  PanelRenderContext,
  RoomPanelInfo,
  TabStripRenderContext,
} from './LayoutSlice';
import {NodeRenderer} from './node-renderers/NodeRenderer';

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface LayoutRendererProps {
  layout: LayoutNode | null;
  panels: Record<string, RoomPanelInfo>;
  className?: string;
  /** Resolve panel metadata and/or render function for dynamic panels */
  resolvePanel?: (panelId: string) => RoomPanelInfo | undefined;
  renderTabStrip?: (
    context: TabStripRenderContext,
  ) => React.ReactNode | undefined;
  /** @deprecated Use resolvePanel with a render field instead */
  renderPanel?: (context: PanelRenderContext) => React.ReactNode | undefined;
  /** @deprecated Use resolvePanel instead */
  resolvePanelInfo?: (panelId: string) => RoomPanelInfo | undefined;
  onLayoutChange?: (layout: LayoutNode | null) => void;
  onTabSelect?: (areaId: string, tabId: string) => void;
  onTabClose?: (areaId: string, tabId: string) => void;
  onTabReorder?: (areaId: string, tabIds: string[]) => void;
  onTabCreate?: (areaId: string) => void;
  onAreaCollapse?: (areaId: string) => void;
  onAreaExpand?: (areaId: string, panelId?: string) => void;
}

// ---------------------------------------------------------------------------
// Main LayoutRenderer
// ---------------------------------------------------------------------------

const LayoutRenderer: FC<LayoutRendererProps> = ({
  layout,
  panels,
  className,
  resolvePanel,
  renderPanel,
  renderTabStrip,
  resolvePanelInfo,
  onLayoutChange,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onTabCreate,
  onAreaCollapse,
  onAreaExpand,
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
        resolvePanel={resolvePanel}
        renderPanel={renderPanel}
        renderTabStrip={renderTabStrip}
        resolvePanelInfo={resolvePanelInfo}
        onLayoutChange={onLayoutChange}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        onTabReorder={onTabReorder}
        onTabCreate={onTabCreate}
        onAreaCollapse={onAreaCollapse}
        onAreaExpand={onAreaExpand}
      />
    </div>
  );
};

export default LayoutRenderer;
