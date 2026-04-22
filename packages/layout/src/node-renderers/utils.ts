import {
  isLayoutNodeKey,
  LayoutNode,
  LayoutNodeSize,
} from '@sqlrooms/layout-config';

/**
 * Normalizes a size value for react-resizable-panels.
 * Numeric values are treated as pixels and converted to strings with 'px' suffix.
 * String values and undefined are returned as-is.
 */
export function normalizePanelSize(
  size: number | string | undefined,
): number | string | undefined {
  if (typeof size === 'number') {
    return `${size}px`;
  }
  return size;
}

export function convertLayoutNodeSizeToStyle(
  size: LayoutNodeSize,
  direction: 'row' | 'column',
): React.CSSProperties {
  return direction === 'column'
    ? {
        height: size.defaultSize ?? 'auto',
        minHeight: size.minSize,
        maxHeight: size.maxSize,
      }
    : {
        width: size.defaultSize ?? 'auto',
        minWidth: size.minSize,
        maxWidth: size.maxSize,
      };
}

export function getLayoutNodeSize(node: LayoutNode): LayoutNodeSize {
  if (isLayoutNodeKey(node)) {
    return {
      collapsible: false,
    };
  }

  return {
    defaultSize: normalizePanelSize(node.defaultSize),
    minSize: normalizePanelSize(node.minSize),
    maxSize: normalizePanelSize(node.maxSize),
    collapsedSize: normalizePanelSize(node.collapsedSize),
    collapsible: node.collapsible ?? false,
  };
}

export function isCollapsed(node: LayoutNode): boolean {
  if (isLayoutNodeKey(node)) {
    return false;
  }

  return node.collapsed === true;
}
