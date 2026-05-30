import {cn, ModifierScrollOverlay} from '@sqlrooms/ui';
import {NodeViewWrapper} from '@tiptap/react';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type FC,
  type MouseEvent as ReactMouseEvent,
  useState,
} from 'react';
import {
  useBlockDocumentStatefulBlockRenderer,
  useBlockDocumentStatefulBlockTypes,
} from '../../BlockDocumentStatefulBlockRendererContext';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditorContext';
import {optionalNumber, optionalString, unknownRecord} from './nodeViewUtils';

type BlockDocumentStatefulBlockNodeViewProps = {
  node: {attrs: Record<string, unknown>};
  selected: boolean;
  updateAttributes: (attrs: Record<string, unknown>) => void;
};

const SCROLL_HINT_HIDE_DELAY_MS = 900;
const SCROLL_EPSILON = 1;

type ScrollAxis = 'x' | 'y';

function clampHeight(value: number, min: number, max?: number) {
  const minBounded = Math.max(min, value);
  return max == null ? minBounded : Math.min(max, minBounded);
}

function isMacOS() {
  return navigator.platform.toLowerCase().includes('mac');
}

function getScrollAxis(event: WheelEvent): ScrollAxis {
  return Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 'x' : 'y';
}

function isScrollableOverflow(value: string) {
  return value === 'auto' || value === 'scroll' || value === 'overlay';
}

function canScrollElement(
  element: HTMLElement,
  axis: ScrollAxis,
  delta: number,
) {
  const style = window.getComputedStyle(element);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  if (!isScrollableOverflow(overflow)) return false;

  const scrollSize = axis === 'y' ? element.scrollHeight : element.scrollWidth;
  const clientSize = axis === 'y' ? element.clientHeight : element.clientWidth;
  if (scrollSize <= clientSize + SCROLL_EPSILON) return false;

  const scrollOffset = axis === 'y' ? element.scrollTop : element.scrollLeft;
  if (delta > 0) {
    return scrollOffset + clientSize < scrollSize - SCROLL_EPSILON;
  }
  if (delta < 0) {
    return scrollOffset > SCROLL_EPSILON;
  }
  return false;
}

function findScrollableAncestor({
  target,
  boundary,
  axis,
  delta,
}: {
  target: EventTarget | null;
  boundary: HTMLElement;
  axis: ScrollAxis;
  delta: number;
}) {
  if (!(target instanceof Element)) return null;

  let element: HTMLElement | null =
    target instanceof HTMLElement ? target : target.parentElement;
  while (element && boundary.contains(element) && element !== boundary) {
    if (canScrollElement(element, axis, delta)) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

function findDocumentScrollParent(element: HTMLElement) {
  let parent = element.parentElement;
  while (parent) {
    if (canScrollElement(parent, 'y', 1) || canScrollElement(parent, 'y', -1)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function scrollElementByWheel(element: HTMLElement, event: WheelEvent) {
  element.scrollBy({
    left: event.deltaX,
    top: event.deltaY,
    behavior: 'auto',
  });
}

export const BlockDocumentStatefulBlockNodeView: FC<
  BlockDocumentStatefulBlockNodeViewProps
> = ({node, selected, updateAttributes}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hideScrollHintTimeoutRef = useRef<number | undefined>(undefined);
  const scrollHintTargetRef = useRef<HTMLElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const {documentId, readOnly} = useBlockDocumentEditorContext();
  const attrs = unknownRecord(node.attrs);
  const blockId = optionalString(attrs.id) ?? '';
  const blockType = optionalString(attrs.blockType) ?? '';
  const blockInstanceId = optionalString(attrs.blockInstanceId) ?? blockId;
  const ownership = optionalString(attrs.ownership);
  const title = optionalString(attrs.title);
  const caption = optionalString(attrs.caption);
  const height = optionalNumber(attrs.height);
  const Renderer = useBlockDocumentStatefulBlockRenderer(blockType);
  const blockTypes = useBlockDocumentStatefulBlockTypes();
  const blockTypeConfig = blockTypes.find(
    (candidate) => candidate.blockType === blockType,
  );
  const resizableHeight = Boolean(blockTypeConfig?.resizableHeight);
  const minHeight = blockTypeConfig?.minHeight ?? 320;
  const maxHeight = blockTypeConfig?.maxHeight;
  const defaultHeight = blockTypeConfig?.defaultHeight ?? 560;
  const requireScrollModifier = Boolean(blockTypeConfig?.requireScrollModifier);
  const scrollHintLabel = blockTypeConfig?.scrollHintLabel ?? 'this block';
  const isMac = useMemo(() => isMacOS(), []);
  const scrollModifierLabel = isMac ? 'Cmd' : 'Ctrl';
  const persistedHeight = resizableHeight
    ? clampHeight(height ?? defaultHeight, minHeight, maxHeight)
    : undefined;
  const [resizingHeight, setResizingHeight] = useState<number | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const resolvedHeight = resizingHeight ?? persistedHeight;

  const wrapperStyle = resolvedHeight ? {height: resolvedHeight} : undefined;

  useEffect(() => {
    return () => {
      if (hideScrollHintTimeoutRef.current !== undefined) {
        window.clearTimeout(hideScrollHintTimeoutRef.current);
      }
      resizeCleanupRef.current?.();
    };
  }, []);

  const showScrollHintTemporarily = useCallback(() => {
    setShowScrollHint(true);
    if (hideScrollHintTimeoutRef.current !== undefined) {
      window.clearTimeout(hideScrollHintTimeoutRef.current);
    }
    hideScrollHintTimeoutRef.current = window.setTimeout(() => {
      setShowScrollHint(false);
      scrollHintTargetRef.current = null;
      hideScrollHintTimeoutRef.current = undefined;
    }, SCROLL_HINT_HIDE_DELAY_MS);
  }, []);

  const hideScrollHint = useCallback(() => {
    setShowScrollHint(false);
    scrollHintTargetRef.current = null;
    if (hideScrollHintTimeoutRef.current !== undefined) {
      window.clearTimeout(hideScrollHintTimeoutRef.current);
      hideScrollHintTimeoutRef.current = undefined;
    }
  }, []);

  const handleWheelCapture = useCallback(
    (event: WheelEvent) => {
      if (!requireScrollModifier) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const hasScrollModifier = isMac ? event.metaKey : event.ctrlKey;
      const axis = getScrollAxis(event);
      const delta = axis === 'y' ? event.deltaY : event.deltaX;
      const internalScrollElement =
        findScrollableAncestor({
          target: event.target,
          boundary: wrapper,
          axis,
          delta,
        }) ?? (showScrollHint ? scrollHintTargetRef.current : null);

      if (!internalScrollElement) {
        hideScrollHint();
        return;
      }

      if (hasScrollModifier) {
        event.preventDefault();
        event.stopPropagation();
        scrollElementByWheel(internalScrollElement, event);
        hideScrollHint();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      scrollHintTargetRef.current = internalScrollElement;
      showScrollHintTemporarily();

      const documentScrollParent = findDocumentScrollParent(wrapper);
      if (documentScrollParent) {
        scrollElementByWheel(documentScrollParent, event);
      } else {
        window.scrollBy({
          left: event.deltaX,
          top: event.deltaY,
          behavior: 'auto',
        });
      }
    },
    [
      hideScrollHint,
      isMac,
      requireScrollModifier,
      showScrollHint,
      showScrollHintTemporarily,
    ],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !requireScrollModifier) return;

    wrapper.addEventListener('wheel', handleWheelCapture, {
      capture: true,
      passive: false,
    });
    return () => {
      wrapper.removeEventListener('wheel', handleWheelCapture, {capture: true});
    };
  }, [handleWheelCapture, requireScrollModifier]);

  useEffect(() => {
    if (!requireScrollModifier || !showScrollHint) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasScrollModifier = isMac ? event.metaKey : event.ctrlKey;
      if (hasScrollModifier) {
        hideScrollHint();
      }
    };

    window.addEventListener('keydown', handleKeyDown, {capture: true});
    return () => {
      window.removeEventListener('keydown', handleKeyDown, {capture: true});
    };
  }, [hideScrollHint, isMac, requireScrollModifier, showScrollHint]);

  const handleResizeMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (readOnly || !resizableHeight || !persistedHeight) return;
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = persistedHeight;
    resizeCleanupRef.current?.();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextHeight = clampHeight(
        Math.round(startHeight + moveEvent.clientY - startY),
        minHeight,
        maxHeight,
      );
      setResizingHeight(nextHeight);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const nextHeight = clampHeight(
        Math.round(startHeight + upEvent.clientY - startY),
        minHeight,
        maxHeight,
      );
      setResizingHeight(null);
      updateAttributes({height: nextHeight});
      resizeCleanupRef.current?.();
    };

    resizeCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      resizeCleanupRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      className={cn(
        'not-prose bg-background group/stateful-block relative my-4 rounded-md border',
        selected && 'ring-ring ring-2',
      )}
      contentEditable={false}
      data-block-document-widget-node-view=""
      style={wrapperStyle}
    >
      <div
        ref={wrapperRef}
        className="relative h-full min-h-0"
        data-scroll-modifier-required={requireScrollModifier || undefined}
      >
        {Renderer ? (
          createElement(Renderer, {
            documentId,
            blockId,
            blockType,
            blockInstanceId,
            ownership,
            title,
            caption,
            height: resolvedHeight,
            readOnly,
            onCaptionChange: (nextCaption: string | undefined) =>
              updateAttributes({caption: nextCaption}),
          })
        ) : (
          <div className="p-4">
            <div className="text-sm font-medium">Stateful block</div>
            <div className="text-muted-foreground mt-1 text-sm">
              No renderer is registered for {blockType || 'this block type'}.
            </div>
            <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
              <span>Block type: {blockType || 'Unconfigured'}</span>
              <span>Instance: {blockInstanceId || 'Unconfigured'}</span>
              {ownership ? <span>Ownership: {ownership}</span> : null}
            </div>
          </div>
        )}
        {resizableHeight && !readOnly ? (
          <div
            className="absolute right-0 bottom-0 left-0 flex h-3 cursor-row-resize items-end justify-center opacity-0 transition-opacity group-hover/stateful-block:opacity-100"
            onMouseDown={handleResizeMouseDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize block height"
          >
            <div className="bg-muted-foreground/50 mb-1 h-1 w-10 rounded-full" />
          </div>
        ) : null}
        <ModifierScrollOverlay
          open={showScrollHint}
          modifierLabel={scrollModifierLabel}
          targetLabel={scrollHintLabel}
        />
      </div>
    </NodeViewWrapper>
  );
};
