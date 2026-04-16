import {
  getLayoutNodeId,
  isLayoutNodeKey,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutNode,
  LayoutNodeSize,
} from '@sqlrooms/layout-config';
import {LayoutPath} from '../types';
import {isDockGeneratedSplitId} from '../docking/dock-layout';

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

export function appendSemanticLayoutPath(
  path: LayoutPath,
  node: LayoutNode,
): LayoutPath {
  if (
    (isLayoutSplitNode(node) || isLayoutTabsNode(node)) &&
    node.pathSegment === false
  ) {
    return path;
  }

  if (isLayoutSplitNode(node) && isDockGeneratedSplitId(node.id)) {
    return path;
  }

  return [...path, getLayoutNodeId(node)];
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
