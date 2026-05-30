/**
 * V1 to V2 Layout Migration
 *
 * Converts legacy v1 layout configs (binary tree with first/second)
 * to v2 layout configs (n-ary tree with children array).
 */

/**
 * Generate a unique ID for layout nodes
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Wrap a node with defaultSize property.
 *
 * @param node - The node to wrap (string or object)
 * @param size - The size value (e.g., "30%")
 * @returns Wrapped node with defaultSize
 */
function wrapWithDefaultSize(node: unknown, size: string): unknown {
  // String → wrap in panel node
  if (typeof node === 'string') {
    return {
      type: 'panel',
      id: node,
      defaultSize: size,
    };
  }

  // Object without defaultSize → add it
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    if (!('defaultSize' in obj)) {
      return {...obj, defaultSize: size};
    }
  }

  // Already has defaultSize or other type → return as-is
  return node;
}

/**
 * Main migration function: converts v1 layout to v2 layout.
 *
 * Handles:
 * 1. Primitives (null, undefined, strings) → pass through
 * 2. Binary tree nodes {first, second, direction, splitPercentage?} → convert to split nodes
 * 3. V2 nodes → ensure id, clean legacy fields, recurse children
 *
 * @param node - The node to migrate
 * @returns Migrated v2 node
 */
export function migrate(node: unknown): unknown {
  // Handle primitives - pass through unchanged
  if (node === null || node === undefined) {
    return node;
  }

  if (typeof node !== 'object') {
    return node;
  }

  const obj = node as Record<string, unknown>;

  // CASE 1: Binary tree node (v1 format)
  // {first, second, direction, splitPercentage?}
  if ('first' in obj && 'second' in obj && 'direction' in obj) {
    // Recursively migrate children
    let firstChild = migrate(obj.first);
    let secondChild = migrate(obj.second);

    // Apply splitPercentage if present
    if ('splitPercentage' in obj && typeof obj.splitPercentage === 'number') {
      const firstPercent = obj.splitPercentage;
      const secondPercent = 100 - obj.splitPercentage;

      firstChild = wrapWithDefaultSize(firstChild, `${firstPercent}%`);
      secondChild = wrapWithDefaultSize(secondChild, `${secondPercent}%`);
    }

    // Return v2 split node
    return {
      type: 'split',
      id: generateId(),
      direction: obj.direction,
      children: [firstChild, secondChild],
    };
  }

  // CASE 2: Already a v2 node - pass through
  // (v2 nodes have 'type' and 'id' fields)
  return obj;
}
