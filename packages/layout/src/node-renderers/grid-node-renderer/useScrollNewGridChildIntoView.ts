import {RefObject, useEffect, useRef} from 'react';

const previousGridChildIdsByNodeId = new Map<string, string[]>();
const pendingGridScrollItemByNodeId = new Map<string, string>();

function getGridItemElement(
  scrollContainer: HTMLElement,
  itemId: string,
): HTMLElement | undefined {
  return Array.from(
    scrollContainer.querySelectorAll<HTMLElement>('[data-layout-grid-item-id]'),
  ).find((element) => element.dataset.layoutGridItemId === itemId);
}

function scrollGridItemIntoView(
  scrollContainer: HTMLElement,
  itemId: string,
): boolean {
  const addedElement = getGridItemElement(scrollContainer, itemId);
  if (!addedElement) {
    return false;
  }

  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const addedElementRect = addedElement.getBoundingClientRect();
  if (addedElementRect.bottom <= scrollContainerRect.bottom) {
    return true;
  }

  scrollContainer.scrollTo({
    top:
      scrollContainer.scrollTop +
      addedElementRect.bottom -
      scrollContainerRect.bottom,
    behavior: 'smooth',
  });
  addedElement.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'smooth',
  });
  return true;
}

export function useScrollNewGridChildIntoView(
  nodeId: string,
  childIds: string[],
  layoutVersion: unknown,
): RefObject<HTMLDivElement | null> {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousChildIds = previousGridChildIdsByNodeId.get(nodeId);
    previousGridChildIdsByNodeId.set(nodeId, childIds);
    if (!previousChildIds) {
      return;
    }

    const previousChildIdSet = new Set(previousChildIds);
    const addedChildId = childIds.find(
      (childId) => !previousChildIdSet.has(childId),
    );
    if (addedChildId) {
      pendingGridScrollItemByNodeId.set(nodeId, addedChildId);
    }

    const pendingScrollItemId = pendingGridScrollItemByNodeId.get(nodeId);
    if (!pendingScrollItemId) {
      return;
    }

    let secondFrame: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
          return;
        }

        if (scrollGridItemIntoView(scrollContainer, pendingScrollItemId)) {
          pendingGridScrollItemByNodeId.delete(nodeId);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame != null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [childIds, layoutVersion, nodeId]);

  return scrollContainerRef;
}
