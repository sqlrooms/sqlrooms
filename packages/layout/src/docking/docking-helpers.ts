import {CSSProperties} from 'react';
import {
  isLayoutSplitNode,
  LayoutDockNode,
  LayoutNode,
} from '@sqlrooms/layout-config';
import {DockDirection, getDockAxis} from './dock-layout';
import {
  findNodeById,
  findNearestDockAncestor,
  FindNodeByIdResult,
} from '../layout-tree';
import {DockPreview, PreviewMode} from './docking-types';

const EDGE_THRESHOLD = 0.25;

type ValidateDockOperationReturn =
  | {
      valid: true;
      sourceFound: FindNodeByIdResult;
      targetFound: FindNodeByIdResult;
      sourceDock: LayoutDockNode;
    }
  | {valid: false};

export function validateDockOperation(
  rootLayout: LayoutNode,
  sourceId: string,
  targetId: string,
): ValidateDockOperationReturn {
  if (sourceId === targetId) {
    return {valid: false};
  }

  const sourceFound = findNodeById(rootLayout, sourceId);
  const targetFound = findNodeById(rootLayout, targetId);

  if (!sourceFound || !targetFound) {
    return {valid: false};
  }

  const sourceDock = findNearestDockAncestor(rootLayout, sourceId);
  const targetDock = findNearestDockAncestor(rootLayout, targetId);

  if (sourceDock !== targetDock || !sourceDock) {
    return {valid: false};
  }

  return {valid: true, sourceFound, targetFound, sourceDock};
}

export function getDockDirection(
  cursorPosition: {x: number; y: number},
  targetRect: {left: number; top: number; width: number; height: number},
): DockDirection {
  // Compute relative position within target rect (0 to 1)
  // Allow some overflow - cursor can be slightly outside rect
  const relX = (cursorPosition.x - targetRect.left) / targetRect.width;
  const relY = (cursorPosition.y - targetRect.top) / targetRect.height;

  // Clamp to reasonable range - allow 10% overflow on each side
  const clampedRelX = Math.max(-0.1, Math.min(1.1, relX));
  const clampedRelY = Math.max(-0.1, Math.min(1.1, relY));

  let direction: DockDirection;

  // Check if cursor is strongly biased towards a horizontal edge
  if (clampedRelX < EDGE_THRESHOLD) {
    direction = 'left';
  } else if (clampedRelX > 1 - EDGE_THRESHOLD) {
    direction = 'right';
  }
  // Check if cursor is strongly biased towards a vertical edge
  else if (clampedRelY < EDGE_THRESHOLD) {
    direction = 'up';
  } else if (clampedRelY > 1 - EDGE_THRESHOLD) {
    direction = 'down';
  }
  // Otherwise use diagonal zone logic
  else {
    const centerX = 0.5;
    const centerY = 0.5;
    const dx = Math.abs(clampedRelX - centerX);
    const dy = Math.abs(clampedRelY - centerY);

    if (dx > dy) {
      direction = clampedRelX < centerX ? 'left' : 'right';
    } else {
      direction = clampedRelY < centerY ? 'up' : 'down';
    }
  }

  return direction;
}

function getContainerElement(splitId: string | undefined): HTMLElement | null {
  if (!splitId || typeof document === 'undefined') {
    return null;
  }

  return document.querySelector<HTMLElement>(
    `[data-layout-split-id="${CSS.escape(splitId)}"]`,
  );
}

function createRowPreview(
  targetLeft: number | null,
  overRect: {width: number; height: number},
  direction: 'left' | 'right',
): {highlightStyle: CSSProperties; lineStyle: CSSProperties} {
  const width = overRect.width / 2;

  if (targetLeft !== null) {
    const left = direction === 'left' ? targetLeft : targetLeft + width;
    return {
      highlightStyle: {
        left,
        top: 0,
        width,
        height: '100%',
      },
      lineStyle: {
        left: direction === 'left' ? left + width : left,
        top: 0,
        width: 2,
        height: '100%',
      },
    };
  }

  const left = direction === 'left' ? 0 : width;
  return {
    highlightStyle: {
      left,
      top: 0,
      width,
      height: '100%',
    },
    lineStyle: {
      left: direction === 'left' ? width : 0,
      top: 0,
      width: 2,
      height: '100%',
    },
  };
}

function createColumnPreview(
  targetTop: number | null,
  overRect: {width: number; height: number},
  direction: 'up' | 'down',
): {highlightStyle: CSSProperties; lineStyle: CSSProperties} {
  const height = overRect.height / 2;

  if (targetTop !== null) {
    const top = direction === 'up' ? targetTop : targetTop + height;
    return {
      highlightStyle: {
        left: 0,
        top,
        width: '100%',
        height,
      },
      lineStyle: {
        left: 0,
        top: direction === 'up' ? top + height : top,
        width: '100%',
        height: 2,
      },
    };
  }

  const top = direction === 'up' ? 0 : height;
  return {
    highlightStyle: {
      left: 0,
      top,
      width: '100%',
      height,
    },
    lineStyle: {
      left: 0,
      top: direction === 'up' ? height : 0,
      width: '100%',
      height: 2,
    },
  };
}

export function buildPreview(
  rootLayout: LayoutNode,
  sourceId: string,
  targetId: string,
  direction: DockDirection,
  overRect: {left: number; top: number; width: number; height: number},
): DockPreview | null {
  const validation = validateDockOperation(rootLayout, sourceId, targetId);

  if (!validation.valid) {
    return null;
  }

  const {targetFound} = validation;
  const parent = targetFound.ancestors[targetFound.ancestors.length - 1];
  const axis = getDockAxis(direction);
  const sameAxisParent =
    parent && isLayoutSplitNode(parent) && parent.direction === axis
      ? parent
      : null;
  const containerRect =
    getContainerElement(sameAxisParent?.id)?.getBoundingClientRect() ??
    overRect;
  const mode: PreviewMode = sameAxisParent ? 'insert' : 'wrap';
  const {highlightStyle, lineStyle} =
    axis === 'row'
      ? createRowPreview(
          mode === 'insert' ? overRect.left - containerRect.left : null,
          overRect,
          direction as 'left' | 'right',
        )
      : createColumnPreview(
          mode === 'insert' ? overRect.top - containerRect.top : null,
          overRect,
          direction as 'up' | 'down',
        );

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
