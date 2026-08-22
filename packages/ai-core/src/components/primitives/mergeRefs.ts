import type {Ref, RefCallback} from 'react';

/**
 * Combines refs into one callback ref that updates all of them, so a
 * primitive can keep its own ref on an element without clobbering the host's.
 *
 * Memoize the result (or the callers' `useCallback`) — a fresh callback makes
 * React detach and reattach the ref on every render.
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
