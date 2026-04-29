import {CSSProperties} from 'react';
import {isLayoutSplitNode, LayoutNode} from '@sqlrooms/layout-config';
import {DockDirection, getDockAxis} from './dock-layout';
import {findNodeById} from '../layout-tree';
import {DockPreview, PreviewMode} from './docking-types';

function getRectCenter(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function getDockDirection(
  activeRect: {left: number; top: number; width: number; height: number},
  targetRect: {left: number; top: number; width: number; height: number},
): DockDirection {
  const center = getRectCenter(activeRect);
  const distances: Record<DockDirection, number> = {
    left: Math.abs(center.x - targetRect.left),
    right: Math.abs(targetRect.left + targetRect.width - center.x),
    up: Math.abs(center.y - targetRect.top),
    down: Math.abs(targetRect.top + targetRect.height - center.y),
  };

  return (Object.entries(distances).sort(([, a], [, b]) => a - b)[0]?.[0] ??
    'right') as DockDirection;
}

function getContainerElement(splitId: string | undefined): HTMLElement | null {
  if (!splitId || typeof document === 'undefined') {
    return null;
  }

  return document.querySelector<HTMLElement>(
    `[data-layout-split-id="${CSS.escape(splitId)}"]`,
  );
}

export function buildPreview(
  rootLayout: LayoutNode,
  sourceId: string,
  targetId: string,
  direction: DockDirection,
  overRect: {left: number; top: number; width: number; height: number},
): DockPreview | null {
  if (sourceId === targetId) {
    return null;
  }

  const found = findNodeById(rootLayout, targetId);
  const parent = found?.ancestors[found.ancestors.length - 1];
  const axis = getDockAxis(direction);
  const sameAxisParent =
    parent && isLayoutSplitNode(parent) && parent.direction === axis
      ? parent
      : null;
  const containerRect =
    getContainerElement(sameAxisParent?.id)?.getBoundingClientRect() ??
    overRect;
  const targetLeft = overRect.left - containerRect.left;
  const targetTop = overRect.top - containerRect.top;

  let highlightStyle: CSSProperties;
  let lineStyle: CSSProperties;
  let mode: PreviewMode;

  if (sameAxisParent) {
    mode = 'insert';

    if (axis === 'row') {
      const width = overRect.width / 2;
      const left = direction === 'left' ? targetLeft : targetLeft + width;

      highlightStyle = {
        left,
        top: 0,
        width,
        height: '100%',
      };
      lineStyle = {
        left: direction === 'left' ? left + width : left,
        top: 0,
        width: 2,
        height: '100%',
      };
    } else {
      const height = overRect.height / 2;
      const top = direction === 'up' ? targetTop : targetTop + height;

      highlightStyle = {
        left: 0,
        top,
        width: '100%',
        height,
      };
      lineStyle = {
        left: 0,
        top: direction === 'up' ? top + height : top,
        width: '100%',
        height: 2,
      };
    }
  } else {
    mode = 'wrap';

    if (axis === 'row') {
      const width = overRect.width / 2;
      const left = direction === 'left' ? 0 : width;

      highlightStyle = {
        left,
        top: 0,
        width,
        height: '100%',
      };
      lineStyle = {
        left: direction === 'left' ? width : 0,
        top: 0,
        width: 2,
        height: '100%',
      };
    } else {
      const height = overRect.height / 2;
      const top = direction === 'up' ? 0 : height;

      highlightStyle = {
        left: 0,
        top,
        width: '100%',
        height,
      };
      lineStyle = {
        left: 0,
        top: direction === 'up' ? height : 0,
        width: '100%',
        height: 2,
      };
    }
  }

  return {
    containerStyle: {
      left: containerRect.left,
      top: containerRect.top,
      width: containerRect.width,
      height: containerRect.height,
    },
    highlightStyle,
    lineStyle,
    mode,
  };
}
