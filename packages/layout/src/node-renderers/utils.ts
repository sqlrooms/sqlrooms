import {
  isLayoutNodeKey,
  LayoutNode,
  LayoutNodeSize,
} from '@sqlrooms/layout-config';

export function convertLayoutNodeSizeToStyle(
  size: LayoutNodeSize,
  direction: 'row' | 'column',
): React.CSSProperties {
  return direction === 'column'
    ? {
        height: (size.defaultSize ?? 'auto') as string | number | undefined,
        minHeight: size.minSize,
        maxHeight: size.maxSize,
      }
    : {
        width: size.defaultSize ?? 'auto',
        minWidth: size.minSize,
        maxWidth: size.maxSize,
      };
}

export function extractPanelId(tabId: string): string {
  return tabId;
}

export function getLayoutNodeSize(node: LayoutNode): LayoutNodeSize {
  if (isLayoutNodeKey(node)) {
    return {
      collapsible: false,
    };
  }

  return {
    defaultSize: node.defaultSize,
    minSize: node.minSize,
    maxSize: node.maxSize,
    collapsedSize: node.collapsedSize,
    collapsible: node.collapsible ?? false,
  };
}

export function isCollapsed(node: LayoutNode): boolean {
  if (isLayoutNodeKey(node)) {
    return false;
  }

  return node.collapsed === true;
}
