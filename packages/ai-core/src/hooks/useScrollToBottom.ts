import {useEffect, useRef, type RefObject, useState, useCallback} from 'react';

interface ScrollToBottomResult {
  showScrollButton: boolean;
  scrollToBottom: () => void;
}

/**
 * Only show button and auto-scroll if we're scrolled up more
 * than {AT_BOTTOM_TOLERANCE}px from the bottom.
 */
const AT_BOTTOM_TOLERANCE = 100;

/**
 * A React hook that provides automatic scrolling behavior for containers with dynamic content.
 *
 * This hook helps manage scroll behavior in containers where content is being added dynamically,
 * such as chat interfaces or logs. It automatically scrolls to the bottom when new content is added
 * if the user was already at the bottom, and provides a function to manually scroll to the bottom.
 *
 * Uses a combination of data observation and DOM mutation/resize observation to reliably
 * detect content changes, even when content grows inside nested fixed-height containers
 * (e.g. collapsed ActivityBox components).
 *
 * @template T - The type of HTMLElement for the container and end references
 *
 * @param options - Configuration options
 * @param options.dataToObserve - The data to observe for changes (messages, items, etc.)
 * @param options.containerRef - Reference to the scrollable container element
 * @param options.endRef - Deprecated, no longer used. Kept for backward compatibility.
 * @param options.scrollOnInitialLoad - Whether to scroll to bottom on initial load (default: true)
 *
 * @returns An object containing:
 *   - showScrollButton: Boolean indicating if the "scroll to bottom" button should be shown
 *   - scrollToBottom: Function to programmatically scroll to the bottom
 *
 * @example
 * ```tsx
 * import { useRef } from 'react';
 * import { useScrollToBottom } from './use-scroll-to-bottom';
 *
 * function Chat({ messages }) {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   const { showScrollButton, scrollToBottom } = useScrollToBottom({
 *     dataToObserve: messages,
 *     containerRef,
 *     scrollOnInitialLoad: false // Disable scrolling on initial load
 *   });
 *
 *   return (
 *     <div className="relative h-[500px]">
 *       <div ref={containerRef} className="h-full overflow-y-auto p-4">
 *         {messages.map((message) => (
 *           <div key={message.id} className="mb-4">
 *             {message.text}
 *           </div>
 *         ))}
 *       </div>
 *
 *       {showScrollButton && (
 *         <button
 *           onClick={scrollToBottom}
 *           className="absolute bottom-4 right-4 rounded-full bg-blue-500 p-2"
 *         >
 *           ↓
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollToBottom<T extends HTMLElement | null>({
  /**
   * The data to observe. Can be an array of items or a single item.
   * When the data changes, the hook will scroll to the bottom of the container.
   */
  dataToObserve,
  containerRef,
  // endRef kept in signature for backward compatibility but no longer used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  endRef: _endRef,
  /**
   * Whether to scroll to bottom on initial load.
   * @default false
   */
  scrollOnInitialLoad = false,
}: {
  dataToObserve: unknown;
  containerRef: RefObject<T | null>;
  /** @deprecated No longer used. The hook now scrolls the container directly. */
  endRef?: RefObject<T | null>;
  scrollOnInitialLoad?: boolean;
}): ScrollToBottomResult {
  const [showScrollButton, setShowButton] = useState(false);

  // Track if user was at bottom before content changes
  // Start as true since we're initially at the bottom
  const wasAtBottomRef = useRef(true);

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  // Track the last known scrollHeight to detect content growth
  const lastScrollHeightRef = useRef(0);

  // Check if the container is scrolled to the bottom
  const checkIfAtBottom = useCallback((container: T) => {
    if (!container) return false;
    const {scrollTop, scrollHeight, clientHeight} = container;
    return scrollHeight - scrollTop - clientHeight <= AT_BOTTOM_TOLERANCE;
  }, []);

  // Use refs for functions to keep them stable and avoid dependency cycles
  const updateScrollStateRef = useRef<() => void>();
  const doScrollToBottomRef = useRef<() => void>();

  updateScrollStateRef.current = () => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom = checkIfAtBottom(container);
    wasAtBottomRef.current = isAtBottom;

    // Use functional update to avoid dependency on showScrollButton
    setShowButton((current) => {
      const next = !isAtBottom;
      return current === next ? current : next;
    });
  };

  doScrollToBottomRef.current = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const updateScrollState = useCallback(() => {
    updateScrollStateRef.current?.();
  }, []);

  const doScrollToBottom = useCallback(() => {
    doScrollToBottomRef.current?.();
  }, []);

  // Handle new content being added (triggered by dataToObserve changes)
  useEffect(() => {
    if (!dataToObserve) return;

    const container = containerRef.current;
    if (!container) return;

    const shouldScroll =
      wasAtBottomRef.current &&
      (!isInitialLoadRef.current || scrollOnInitialLoad);

    if (shouldScroll) {
      // Use rAF to scroll after React has committed DOM updates
      requestAnimationFrame(() => {
        doScrollToBottomRef.current?.();
        updateScrollStateRef.current?.();
      });
    } else {
      // Just update state without scrolling
      requestAnimationFrame(() => {
        updateScrollStateRef.current?.();
      });
    }

    isInitialLoadRef.current = false;
  }, [containerRef, dataToObserve, scrollOnInitialLoad]);

  // Observe DOM mutations and resizes inside the scroll container.
  // This catches content changes that don't correspond to a dataToObserve
  // update (e.g. content expanding inside a collapsed ActivityBox, lazy
  // renders, or async component updates).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onContentChange = () => {
      const prevHeight = lastScrollHeightRef.current;
      const newHeight = container.scrollHeight;
      lastScrollHeightRef.current = newHeight;

      if (newHeight > prevHeight && wasAtBottomRef.current) {
        requestAnimationFrame(() => {
          doScrollToBottomRef.current?.();
          updateScrollStateRef.current?.();
        });
      } else {
        requestAnimationFrame(() => {
          updateScrollStateRef.current?.();
        });
      }
    };

    const ro = new ResizeObserver(onContentChange);
    const mo = new MutationObserver(onContentChange);

    // Observe the first child (content wrapper) if it exists, otherwise the container
    const target = container.firstElementChild ?? container;
    ro.observe(target);
    mo.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    lastScrollHeightRef.current = container.scrollHeight;

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [containerRef]);

  // Listen for user scroll events to update button visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      updateScrollStateRef.current?.();
    };
    container.addEventListener('scroll', onScroll, {passive: true});

    const timeoutId = setTimeout(() => {
      updateScrollStateRef.current?.();
    }, 100);

    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [containerRef]);

  return {
    showScrollButton,
    scrollToBottom,
  };
}
