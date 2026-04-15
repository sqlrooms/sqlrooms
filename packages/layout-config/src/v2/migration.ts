// ---------------------------------------------------------------------------
// Legacy types — for migration only
// ---------------------------------------------------------------------------

import {LayoutDirection} from './common';

interface LegacyBinaryNode {
  direction: LayoutDirection;
  first: unknown;
  second: unknown;
  splitPercentage?: number;
}

/**
 * Recursively migrate legacy layout formats to the current schema.
 * Handles:
 * 1. Legacy binary tree (v6): { first, second, direction } -> { type: 'split', children }
 * 2. Outer wrapper unwrap: { type: 'mosaic', nodes } -> nodes (the inner tree)
 * 3. Legacy tabs prop: { type: 'tabs', tabs: [...] } -> { type: 'tabs', children: [...] }
 * 4. Strip removed fields: splitPercentages, savedPercentages
 */
export function convertLegacyNode(node: unknown): unknown {
  if (typeof node === 'string' || node == null) {
    return node;
  }

  if (typeof node !== 'object') {
    return node;
  }

  const obj = {...node} as Record<string, unknown>;

  // Unwrap the outer { type: 'mosaic', nodes: ... } wrapper
  if (obj.type === 'mosaic' && 'nodes' in obj && !('id' in obj)) {
    return {
      ...(convertLegacyNode(obj.nodes) as Record<string, unknown>),
      id: 'root',
    };
  }

  if (!('id' in node)) {
    obj.id = Math.random().toString(36).substring(2, 15);
  }

  // Already in typed format — apply field migrations
  if (
    'type' in obj &&
    (obj.type === 'split' ||
      obj.type === 'tabs' ||
      obj.type === 'mosaic' ||
      obj.type === 'panel')
  ) {
    let result = obj;

    // Migrate legacy tabs property -> children
    if (obj.type === 'tabs' && 'tabs' in obj && !('children' in obj)) {
      const {tabs, ...rest} = result;
      result = {...rest, children: tabs};
    }

    // Migrate splitPercentages -> per-child defaultSize
    if ('splitPercentages' in result) {
      const pcts = result.splitPercentages as number[] | undefined;
      const children = (result.children ?? []) as unknown[];
      if (Array.isArray(pcts) && Array.isArray(children)) {
        result = {
          ...result,
          children: children.map((child, i) => {
            const size = pcts[i];
            if (size == null) return child;
            if (typeof child === 'string') {
              return {type: 'panel', id: child, defaultSize: `${size}%`};
            }
            if (
              typeof child === 'object' &&
              child != null &&
              !('defaultSize' in (child as Record<string, unknown>))
            ) {
              return {
                ...(child as Record<string, unknown>),
                defaultSize: `${size}%`,
              };
            }
            return child;
          }),
        };
      }
      const {splitPercentages: _sp, ...rest} = result;
      result = rest;
    }

    // Strip other removed fields
    if ('savedPercentages' in result) {
      const {savedPercentages, ...rest} = result;
      result = rest;
    }

    return result;
  }

  // Legacy binary format detected
  if ('first' in obj && 'second' in obj) {
    const legacy = obj as unknown as LegacyBinaryNode;
    return {
      type: 'split' as const,
      direction: legacy.direction,
      children: [
        convertLegacyNode(legacy.first),
        convertLegacyNode(legacy.second),
      ],
    };
  }

  return node;
}
