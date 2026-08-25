import {Slot} from '@sqlrooms/ui';
import {forwardRef, type ComponentPropsWithoutRef} from 'react';
import {usePromptSuggestions} from './ChatSuggestionsContext';
import {ControlledVisibilityProvider} from './controlledVisibility';

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
   *
   * Pair it with {@link onOpenChange}: while controlled, `Dismiss` and
   * `VisibilityToggle` rendered inside this root report through that callback
   * instead of writing the store this prop overrides. Without it they cannot
   * affect what is rendered, which is the disagreement this prop exists to
   * avoid.
   */
  open?: boolean;
  /**
   * Called by the visibility controls inside this root while {@link open} is
   * provided. Ignored when uncontrolled, where those controls write the
   * normalized store directly.
   */
  onOpenChange?: (open: boolean) => void;
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
  function Root({asChild, open, onOpenChange, ...rest}, ref) {
    const suggestions = usePromptSuggestions();
    const isVisible = open ?? suggestions.visible;

    if (!isVisible) return null;

    const Comp = asChild ? Slot : 'div';

    return (
      <ControlledVisibilityProvider open={open} onOpenChange={onOpenChange}>
        <Comp ref={ref} {...rest} />
      </ControlledVisibilityProvider>
    );
  },
);
