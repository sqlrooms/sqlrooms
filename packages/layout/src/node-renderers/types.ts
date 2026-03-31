import {isLayoutTabsNode, LayoutNode} from '@sqlrooms/layout-config';
import type {
  LayoutPath,
  PanelRenderContext,
  RoomPanelInfo,
  TabStripRenderContext,
} from '../LayoutSlice';

export interface NodeRenderProps {
  node: LayoutNode;
  path: LayoutPath;
  containerType: PanelRenderContext['containerType'];
  containerId?: string;
  /** Direction of the parent split, used for expand button icon orientation */
  parentDirection?: 'row' | 'column';
  panels: Record<string, RoomPanelInfo>;
  rootLayout: LayoutNode;
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

/**
 * Resolve panel info by checking the static panels registry first,
 * then walking up the path to find the nearest ancestor with resolveChild.
 */
export function lookupPanelInfo(
  context: PanelRenderContext,
  panels: Record<string, RoomPanelInfo>,
): RoomPanelInfo | undefined {
  const direct = panels[context.panelId];
  if (direct) return direct;

  for (let i = context.path.length - 1; i >= 0; i--) {
    const segment = context.path[i];
    if (typeof segment === 'string') {
      const ancestor = panels[segment];
      if (ancestor?.resolveChild) {
        const resolved = ancestor.resolveChild(context);
        if (resolved) return resolved;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Size / child helpers shared by renderers
// ---------------------------------------------------------------------------

export function getSizeProps(node: LayoutNode) {
  if (typeof node === 'string') return {};
  const result: Record<string, unknown> = {};
  if ('defaultSize' in node && node.defaultSize != null)
    result.defaultSize = node.defaultSize;
  if ('minSize' in node && node.minSize != null) result.minSize = node.minSize;
  if ('maxSize' in node && node.maxSize != null) result.maxSize = node.maxSize;
  if ('collapsedSize' in node && node.collapsedSize != null)
    result.collapsedSize = node.collapsedSize;
  if ('collapsible' in node && node.collapsible != null)
    result.collapsible = node.collapsible;
  return result;
}

export function getPanelId(node: LayoutNode, index: number): string {
  if (typeof node === 'string') return node;
  if ('id' in node && node.id) return node.id;
  return `panel-${index}`;
}

export function isChildCollapsed(child: LayoutNode): boolean {
  return isLayoutTabsNode(child) && child.collapsed === true;
}

export function isChildCollapsible(child: LayoutNode): boolean {
  if (typeof child === 'string') return false;
  return 'collapsible' in child && child.collapsible === true;
}

export function getChildAreaId(child: LayoutNode): string | undefined {
  if (typeof child === 'string') return undefined;
  if ('id' in child) return child.id;
  return undefined;
}
