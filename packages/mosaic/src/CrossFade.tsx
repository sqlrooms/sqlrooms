import {cn} from '@sqlrooms/ui';
import {
  FC,
  forwardRef,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react';

const CrossFadeLayer = forwardRef<
  HTMLDivElement,
  {isActive: boolean; duration: number}
>(({isActive, duration}, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute inset-0 transition-opacity',
      isActive ? 'opacity-100' : 'pointer-events-none opacity-0',
    )}
    style={{transitionDuration: `${duration}ms`}}
  />
));

CrossFadeLayer.displayName = 'CrossFadeLayer';

type CrossFadeProps = PropsWithChildren<{
  /**
   * Function that receives a ref and returns the content to render.
   * Called when content needs to be updated.
   */
  renderContent: (ref: HTMLDivElement) => void | Promise<void>;
  /**
   * Dependency that triggers content re-render when changed
   */
  contentKey: unknown;
  /**
   * Duration of the fade transition in milliseconds
   */
  duration?: number;
  className?: string;
}>;

/**
 * Generic crossfade container that smoothly transitions between content updates.
 * Maintains two layers and crossfades between them when contentKey changes.
 */
export const CrossFade: FC<CrossFadeProps> = ({
  renderContent,
  contentKey,
  duration = 450,
  className,
  children,
}) => {
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<1 | 2>(1);

  useEffect(() => {
    let cancelled = false;
    const targetLayer = activeLayer === 1 ? 2 : 1;
    const targetRef = targetLayer === 1 ? layer1Ref : layer2Ref;
    const oldRef = activeLayer === 1 ? layer1Ref : layer2Ref;

    if (!targetRef.current) return;

    Promise.resolve(renderContent(targetRef.current)).then(() => {
      if (cancelled) return;
      setActiveLayer(targetLayer);

      // Clean up old layer after transition completes
      setTimeout(() => {
        if (!cancelled && oldRef.current) {
          oldRef.current.replaceChildren();
        }
      }, duration);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, duration]);

  return (
    <div className={cn('relative', className)}>
      <CrossFadeLayer
        ref={layer1Ref}
        isActive={activeLayer === 1}
        duration={duration}
      />
      <CrossFadeLayer
        ref={layer2Ref}
        isActive={activeLayer === 2}
        duration={duration}
      />
      {children}
    </div>
  );
};
