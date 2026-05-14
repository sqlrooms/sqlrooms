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
  // endRef is kept in the signature for backward compatibility but is no longer used
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

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom = checkIfAtBottom(container);
    wasAtBottomRef.current = isAtBottom;
    setShowButton(!isAtBottom);
  }, [checkIfAtBottom, containerRef]);

  const doScrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [containerRef]);

  // Handle new content being added (triggered by dataToObserve changes)
  useEffect(() => {
    if (!dataToObserve) return;

    const container = containerRef.current;

    if (container && wasAtBottomRef.current) {
      if (!isInitialLoadRef.current || scrollOnInitialLoad) {
        // Use rAF to scroll after React has committed DOM updates
        requestAnimationFrame(() => {
          doScrollToBottom();
          updateScrollState();
        });
      }
    }

    isInitialLoadRef.current = false;
    updateScrollState();
  }, [
    containerRef,
    dataToObserve,
    doScrollToBottom,
    updateScrollState,
    scrollOnInitialLoad,
  ]);

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
          doScrollToBottom();
          updateScrollState();
        });
      } else {
        updateScrollState();
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
  }, [containerRef, doScrollToBottom, updateScrollState]);

  // Listen for user scroll events to update button visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => updateScrollState();
    container.addEventListener('scroll', onScroll, {passive: true});

    const timeoutId = setTimeout(updateScrollState, 100);

    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef, updateScrollState]);

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
