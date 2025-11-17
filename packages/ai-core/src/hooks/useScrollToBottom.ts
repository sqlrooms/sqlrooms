import {useEffect, useRef, type RefObject, useState, useCallback} from 'react';

interface ScrollToBottomResult<T extends HTMLElement | null> {
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
 * @template T - The type of HTMLElement for the container and end references
 *
 * @param options - Configuration options
 * @param options.dataToObserve - The data to observe for changes (messages, items, etc.)
 * @param options.containerRef - Reference to the scrollable container element
 * @param options.endRef - Reference to an element at the end of the content
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
 * function ChatContainer({ messages }) {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const endRef = useRef<HTMLDivElement>(null);
 *
 *   const { showScrollButton, scrollToBottom } = useScrollToBottom({
 *     dataToObserve: messages,
 *     containerRef,
 *     endRef,
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
 *         <div ref={endRef} />
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
  endRef,
  /**
   * Whether to scroll to bottom on initial load.
   * @default false
   */
  scrollOnInitialLoad = false,
}: {
  dataToObserve: unknown;
  containerRef: RefObject<T | null>;
  endRef: RefObject<T | null>;
  scrollOnInitialLoad?: boolean;
}): ScrollToBottomResult<T> {
  const [showScrollButton, setShowButton] = useState(false);

  // Track if user was at bottom before content changes
  // Start as true since we're initially at the bottom
  const wasAtBottomRef = useRef(true);

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  // Check if the container is scrolled to the bottom
  const checkIfAtBottom = useCallback((container: T) => {
    if (!container) return false;
    const {scrollTop, scrollHeight, clientHeight} = container;
    return scrollHeight - scrollTop - clientHeight <= AT_BOTTOM_TOLERANCE;
  }, []);

  // Extracted reusable handleScroll function
  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom = checkIfAtBottom(container);

    // Update wasAtBottom state for next content change
    wasAtBottomRef.current = isAtBottom;

    // Show button only if not at bottom
    setShowButton(!isAtBottom);
  }, [checkIfAtBottom, containerRef]);

  // Handle new content being added
  useEffect(() => {
    if (!dataToObserve) return;

    const container = containerRef.current;
    const end = endRef.current;

    if (container && end && wasAtBottomRef.current) {
      // Only scroll if this is not the initial load or if scrollOnInitialLoad is true
      if (!isInitialLoadRef.current || scrollOnInitialLoad) {
        end.scrollIntoView({behavior: 'instant', block: 'end'});
      }
    }

    // Mark that initial load is complete
    isInitialLoadRef.current = false;

    // After content change, check scroll position again
    onScroll();
  }, [containerRef, dataToObserve, endRef, onScroll, scrollOnInitialLoad]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', onScroll);

    // Initial check with a slight delay to ensure proper measurement
    const timeoutId = setTimeout(onScroll, 100);

    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef, onScroll]);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  return {
    showScrollButton,
    scrollToBottom,
  };
}
