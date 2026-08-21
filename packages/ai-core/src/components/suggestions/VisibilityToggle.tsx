import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link VisibilityToggle}.
 */
export type ChatSuggestionsVisibilityToggleProps = Omit<
  ActionButtonProps,
  'onActivate'
>;

/**
 * Toggles suggestions visibility on activation, exposing the current state as
 * `aria-pressed` so a host can style it without this component owning classes.
 *
 * Can live anywhere under `<Chat>` — including outside the composer or the
 * list itself — and stays in sync, because visibility lives in the normalized
 * state rather than a container-scoped context.
 */
export const VisibilityToggle = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsVisibilityToggleProps
>(function VisibilityToggle({'aria-pressed': ariaPressed, ...rest}, ref) {
  const suggestions = usePromptSuggestions();

  const handleActivate = useCallback(() => {
    suggestions.toggle();
  }, [suggestions]);

  return (
    <ActionButton
      ref={ref}
      aria-pressed={ariaPressed ?? suggestions.visible}
      onActivate={handleActivate}
      {...rest}
    />
  );
});
