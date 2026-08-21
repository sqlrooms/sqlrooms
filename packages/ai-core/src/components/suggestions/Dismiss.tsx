import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link Dismiss}.
 */
export type ChatSuggestionsDismissProps = Omit<ActionButtonProps, 'onActivate'>;

/**
 * Hides suggestions on activation, unconditionally — unlike
 * {@link VisibilityToggle}, this never re-shows them.
 */
export const Dismiss = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsDismissProps
>(function Dismiss(props, ref) {
  const suggestions = usePromptSuggestions();

  const handleActivate = useCallback(() => {
    suggestions.setVisible(false);
  }, [suggestions]);

  return <ActionButton ref={ref} onActivate={handleActivate} {...props} />;
});
