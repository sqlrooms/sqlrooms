import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {mergeHandlers} from '../composer/mergeHandlers';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link Dismiss}.
 */
export type ChatSuggestionsDismissProps = ComponentPropsWithoutRef<'button'> & {
  /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
  asChild?: boolean;
};

/**
 * Hides suggestions on activation, unconditionally (unlike {@link
 * VisibilityToggle}, this never re-shows them). Gives a host a way to
 * reclaim the space suggestions occupy without a visibility toggle
 * elsewhere in the UI.
 */
export const Dismiss = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsDismissProps
>(function Dismiss({asChild, onClick, ...rest}, ref) {
  const suggestions = usePromptSuggestions();

  const handleClick = useCallback(() => {
    suggestions.setVisible(false);
  }, [suggestions]);

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      onClick={mergeHandlers(onClick, handleClick)}
      {...rest}
    />
  );
});
