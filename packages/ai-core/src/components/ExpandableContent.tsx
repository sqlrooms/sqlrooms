import {cn} from '@sqlrooms/ui';
import {ChevronDown, ChevronsUp} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';

const DEFAULT_MAX_HEIGHT = 80;

type ExpandableContentProps = {
  children: React.ReactNode;
  /** Max collapsed height in px. Defaults to 300. */
  maxHeight?: number;
  className?: string;
  /** Show "Show more" / "Collapse" labels. Defaults to true. */
  showLabels?: boolean;
  /** Height of the gradient fade overlay in px. Defaults to 112 when showLabels is true, 40 otherwise. */
  fadeHeight?: number;
};

/**
 * A container that caps content at a max height with a subtle gradient
 * fade at the bottom. Clicking expands it to reveal all content.
 * When {@link ExpandableContentProps.showLabels} is true (default), a
 * "Show more" hint and a "Collapse" button are displayed; when false
 * only the gradient + chevron icon are shown.
 *
 * If the content fits within the max height the wrapper is invisible.
 */
export const ExpandableContent: React.FC<ExpandableContentProps> = ({
  children,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
  showLabels = true,
  fadeHeight,
}) => {
  const resolvedFadeHeight = fadeHeight ?? (showLabels ? 30 : 40);
  const innerRef = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.maxHeight = 'none';
    const h = el.scrollHeight;
    setNaturalHeight(h);
    if (!expanded && h > maxHeight) {
      el.style.maxHeight = `${maxHeight}px`;
    } else {
      el.style.maxHeight = '';
    }
  }, [expanded, maxHeight]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    measure();

    const ro = new ResizeObserver(() => measure());
    const mo = new MutationObserver(() => measure());
    ro.observe(el);
    mo.observe(el, {childList: true, subtree: true, characterData: true});

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  const overflows = naturalHeight != null && naturalHeight > maxHeight;
  const showOverlay = overflows && !expanded;

  return (
    <div
      className={cn(
        showLabels && overflows && 'border-border/50 rounded-lg border',
        showOverlay && 'cursor-pointer',
        className,
      )}
      onClick={showOverlay ? () => setExpanded(true) : undefined}
    >
      <div className="relative">
        <div
          ref={innerRef}
          className={cn('overflow-hidden', showLabels && overflows && 'p-4')}
        >
          {children}
        </div>

        {showOverlay && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0',
              showLabels && 'rounded-b-lg',
            )}
            style={{
              height: `${resolvedFadeHeight}px`,
              background: showLabels
                ? 'linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.7) 40%, hsl(var(--background) / 0.95) 70%, hsl(var(--background)) 100%)'
                : 'linear-gradient(to bottom, transparent 0%, currentColor 100%)',
              ...(showLabels ? {} : {color: 'hsl(var(--muted))', opacity: 0.8}),
            }}
          />
        )}
      </div>

      {showOverlay && (
        <div
          className={cn(
            'flex items-center justify-center',
            showLabels ? 'pt-0.5 pb-1' : 'py-0.5',
          )}
        >
          <ChevronDown className="text-muted-foreground/60 h-4 w-4" />
          {showLabels && (
            <span className="text-muted-foreground/60 ml-1 text-[10px] select-none">
              Show more
            </span>
          )}
        </div>
      )}

      {expanded && overflows && (
        <div
          className={cn(
            'flex justify-center',
            showLabels ? 'border-border/50 border-t py-1' : 'py-0.5',
          )}
        >
          <button
            onClick={() => setExpanded(false)}
            className={cn(
              'text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 rounded-full text-xs transition-colors',
              showLabels ? 'hover:bg-muted/50 px-3 py-0.5' : 'p-0.5',
            )}
          >
            <ChevronsUp className="h-3 w-3" />
            {showLabels && 'Collapse'}
          </button>
        </div>
      )}
    </div>
  );
};
