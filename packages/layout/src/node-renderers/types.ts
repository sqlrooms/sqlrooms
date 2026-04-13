import {isLayoutNodeKey, LayoutNode} from '@sqlrooms/layout-config';
import type {LayoutPath, PanelContainerType} from '../types';

export type ParentDirection = 'row' | 'column';

export interface NodeRenderProps<TNode extends LayoutNode = LayoutNode> {
  node: TNode;
  path: LayoutPath;
  containerType: PanelContainerType;
  containerId?: string;
  /** Direction of the parent split, used for expand button icon orientation */
  parentDirection?: ParentDirection;
}

// ---------------------------------------------------------------------------
// Size / child helpers shared by renderers
// ---------------------------------------------------------------------------

export type SizeProps = {
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  collapsedSize?: number | string;
  collapsible: boolean;
};

export function getSizeProps(node: LayoutNode): SizeProps {
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

export function getPanelId(node: LayoutNode): string {
  if (isLayoutNodeKey(node)) {
    return node;
  }

  return node.id;
}

export function isCollapsed(node: LayoutNode): boolean {
  if (isLayoutNodeKey(node)) {
    return false;
  }

  return node.collapsed === true;
}

export function getChildAreaId(node: LayoutNode): string | undefined {
  if (isLayoutNodeKey(node)) {
    return undefined;
  }

  return node.id;
}
