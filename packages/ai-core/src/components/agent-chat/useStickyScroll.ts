import {useEffect, useRef, type RefObject} from 'react';

const SCROLL_THRESHOLD = 100;

/**
 * Pin a scroll container to the bottom whenever `dep` changes, but only if
 * the user was already near the bottom at the time of the change. This
 * prevents the view from being yanked back to the bottom when the user has
 * scrolled up to read prior messages.
 *
 * Pass `messages.length` (not the array reference) so the effect fires only
 * when a new message arrives rather than on every streaming token.
 */
export function useStickyScroll<T extends HTMLElement = HTMLDivElement>(
  dep: unknown,
): RefObject<T> {
  const ref = useRef<T | null>(null);
  // Track whether the user was near the bottom before the latest dep change.
  const wasAtBottomRef = useRef(true);

  // Keep wasAtBottomRef up-to-date as the user scrolls.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      wasAtBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    };

    el.addEventListener('scroll', handleScroll, {passive: true});
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Only snap to bottom when a new message arrives and the user was already
  // near the bottom.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!wasAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);

  return ref as RefObject<T>;
}
