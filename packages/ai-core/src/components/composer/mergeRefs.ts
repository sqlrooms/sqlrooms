import type {Ref, RefCallback} from 'react';

/**
 * Combines multiple refs into one callback ref that updates all of them.
 *
 * Used so a primitive can attach its own ref to an element (to manage
 * auto-resize, for instance) while still forwarding whatever ref the host
 * passed in, rather than one clobbering the other.
 */
export function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined>
): RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as {current: T | null}).current = node;
      }
    }
  };
}
