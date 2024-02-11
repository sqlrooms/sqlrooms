import {RefObject, useCallback, useEffect, useRef} from 'react';
import {
  arrow,
  flip,
  getOverflowAncestors,
  offset,
  ReferenceType,
  shift,
  useFloating,
  UseFloatingReturn,
  autoUpdate,
} from '@floating-ui/react-dom-interactions';
import {DEFAULT_ARROW_SIZE} from './FloatingTooltipArrow';
import {UseFloatingProps} from '@floating-ui/react-dom-interactions';

export type UseFloatingTooltipReturn<
  ContainerElementType extends Element = Element,
  TargetElementType extends ReferenceType = ReferenceType,
> = {
  containerRef: RefObject<ContainerElementType>;
  floating: UseFloatingReturn<TargetElementType>;
  floatingArrowRef: RefObject<HTMLElement>;
};

export type Props = Partial<UseFloatingProps> & {
  shiftPadding?: number;
  offsetValue?: number;
};

export default function useFloatingTooltip<
  ContainerElementType extends Element = Element,
  TargetElementType extends ReferenceType = ReferenceType,
>(
  props: Props,
): UseFloatingTooltipReturn<ContainerElementType, TargetElementType> {
  const {offsetValue = DEFAULT_ARROW_SIZE, shiftPadding = 5} = props;
  const containerRef = useRef<ContainerElementType>(null);
  const floatingArrowRef = useRef<HTMLElement>(null);
  const floating = useFloating<TargetElementType>({
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(offsetValue),
      flip(),
      shift({padding: shiftPadding}),
      arrow({element: floatingArrowRef}),
    ],
    ...props,
  });

  const {onOpenChange} = floating.context;
  const handleScroll = useCallback(() => {
    // floating.update();
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      getOverflowAncestors(container).forEach((el) => {
        el.addEventListener('scroll', handleScroll);
      });
      return () => {
        if (container) {
          getOverflowAncestors(container).forEach((el) => {
            el.removeEventListener('scroll', handleScroll);
          });
        }
      };
    }
  }, [handleScroll]);

  const handleKeyDown = useCallback(
    (evt: Event) => {
      if (evt instanceof KeyboardEvent && evt.key === 'Escape') {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );
  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // const cleanup = autoUpdate(referenceEl, floatingEl, () => {
  //   computePosition(referenceEl, floatingEl).then(({x, y}) => {
  //     // ...
  //   });
  // });

  return {
    containerRef,
    floating,
    floatingArrowRef,
  };
}
