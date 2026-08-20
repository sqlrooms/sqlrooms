import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {mergeHandlers} from '../composer/mergeHandlers';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link VisibilityToggle}.
 */
export type ChatSuggestionsVisibilityToggleProps =
  ComponentPropsWithoutRef<'button'> & {
    /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
    asChild?: boolean;
  };

/**
 * Toggles suggestions visibility on activation, and exposes the current
 * state via `aria-pressed` so a host can style pressed/unpressed without
 * this component owning any visual classes.
 *
 * Can be rendered anywhere under `<Chat>` — including outside the composer
 * or the suggestions list itself — and still stays in sync, because
 * visibility lives in {@link usePromptSuggestions}'s normalized state, not in
 * a container-scoped context.
 */
export const VisibilityToggle = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsVisibilityToggleProps
>(function VisibilityToggle(
  {asChild, onClick, 'aria-pressed': ariaPressed, ...rest},
  ref,
) {
  const suggestions = usePromptSuggestions();

  const handleClick = useCallback(() => {
    suggestions.toggle();
  }, [suggestions]);

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      aria-pressed={ariaPressed ?? suggestions.visible}
      onClick={mergeHandlers(onClick, handleClick)}
      {...rest}
    />
  );
});
