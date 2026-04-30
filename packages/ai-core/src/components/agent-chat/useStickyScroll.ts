import {useEffect, useRef, type RefObject} from 'react';

/**
 * Pin a scroll container to the bottom whenever the provided dep changes
 * (e.g. the messages array). Returns a ref to attach to the scroll viewport.
 */
export function useStickyScroll<T extends HTMLElement = HTMLDivElement>(
  dep: unknown,
): RefObject<T> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref as RefObject<T>;
}
