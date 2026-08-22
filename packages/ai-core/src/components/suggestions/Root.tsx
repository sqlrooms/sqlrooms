import {Slot} from '@sqlrooms/ui';
import {forwardRef, type ComponentPropsWithoutRef} from 'react';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link Root}.
 */
export type ChatSuggestionsRootProps = ComponentPropsWithoutRef<'div'> & {
  /** Render as the single child element instead of a `<div>`, via Radix's `Slot`. */
  asChild?: boolean;
  /**
   * Overrides the store's visibility state when provided. Use this when a
   * host's own popover, dropdown, or overlay already owns open/closed state
   * and suggestions visibility should simply follow it, rather than
   * maintaining a second, possibly-disagreeing visibility flag.
   */
  open?: boolean;
};

/**
 * Visibility gate for a suggestions list: renders nothing when suggestions
 * are hidden, and its single child (or a plain `<div>`) otherwise.
 *
 * Carries **no position, size, or overflow styling** — a host's own
 * popover, overlay, in-flow container, or horizontal scroller owns all of
 * that. This is what keeps the same primitive expressible as a full-width
 * vertical list, a popover anchored elsewhere in the tree, or a horizontal
 * carousel.
 */
export const Root = forwardRef<HTMLDivElement, ChatSuggestionsRootProps>(
  function Root({asChild, open, ...rest}, ref) {
    const suggestions = usePromptSuggestions();
    const isVisible = open ?? suggestions.visible;

    if (!isVisible) return null;

    const Comp = asChild ? Slot : 'div';

    return <Comp ref={ref} {...rest} />;
  },
);
