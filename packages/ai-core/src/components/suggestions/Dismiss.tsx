import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {usePromptSuggestions} from './ChatSuggestionsContext';
import {useControlledVisibility} from './controlledVisibility';

/**
 * Props for {@link Dismiss}.
 */
export type ChatSuggestionsDismissProps = Omit<ActionButtonProps, 'onActivate'>;

/**
 * Hides suggestions on activation, unconditionally — unlike
 * {@link VisibilityToggle}, this never re-shows them.
 *
 * Inside a controlled `Root`, reports through its `onOpenChange` rather than
 * writing the store that root overrides.
 */
export const Dismiss = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsDismissProps
>(function Dismiss(props, ref) {
  const suggestions = usePromptSuggestions();
  const controlled = useControlledVisibility();

  const handleActivate = useCallback(() => {
    (controlled ?? suggestions).setVisible(false);
  }, [controlled, suggestions]);

  return <ActionButton ref={ref} onActivate={handleActivate} {...props} />;
});
