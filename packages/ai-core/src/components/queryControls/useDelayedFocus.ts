import {useEffect, type RefObject} from 'react';

/**
 * Focuses the element once the surrounding panel has settled. The delay exists
 * because the composer often mounts inside a resizable/animating panel where an
 * immediate focus is lost or scrolls the wrong container.
 */
export function useDelayedFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
  delayMs = 500,
): void {
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.focus(), delayMs);
    return () => clearTimeout(timer);
  }, [ref, delayMs]);
}
