import {useEffect, useRef, type RefObject, useState} from 'react';

export function useScrollToBottom<T extends HTMLElement>(
  options: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
    // attributes: true,
  },
): [RefObject<T>, RefObject<T>] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (container && end) {
      const observer = new MutationObserver(() => {
        end.scrollIntoView({behavior: 'instant', block: 'end'});
      });

      observer.observe(container, options);

      return () => observer.disconnect();
    }
  }, [options]);

  return [containerRef, endRef];
}

export function useScrollToBottomButton(containerRef: RefObject<HTMLElement>) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const {scrollTop, scrollHeight, clientHeight} = container;
      // Only show if we're scrolled up more than 200px from the bottom
      const isNotAtBottom = scrollHeight - scrollTop - clientHeight > 200;
      setShowButton(isNotAtBottom);
    };

    container.addEventListener('scroll', handleScroll);

    // Initial check with a slight delay to ensure proper measurement
    const timeoutId = setTimeout(handleScroll, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef]);

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  return {showButton, scrollToBottom};
}
