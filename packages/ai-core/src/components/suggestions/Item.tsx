import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link Item}.
 */
export type ChatSuggestionsItemProps = Omit<ActionButtonProps, 'onActivate'> & {
  /** The suggestion's text. */
  text: string;
  /**
   * Send `text` on activation instead of filling it into the prompt.
   * Defaults to `false` (fill).
   *
   * Submitting reuses the composer's `send`, so — like fill — it overwrites a
   * non-empty draft rather than appending to it.
   */
  submit?: boolean;
};

/**
 * A single suggestion. Fills the composer's prompt with `text` on activation,
 * or sends it when `submit` is passed. Disabled whenever
 * {@link usePromptSuggestions}'s `isReadyToSend` is false, so suggestions and
 * the send control never disagree.
 *
 * Carries no width, height, truncation, or tooltip — the host places, sizes,
 * and labels it.
 */
export const Item = forwardRef<HTMLButtonElement, ChatSuggestionsItemProps>(
  function Item({text, submit = false, disabled, ...rest}, ref) {
    const suggestions = usePromptSuggestions();

    const handleActivate = useCallback(() => {
      if (submit) {
        suggestions.send(text);
      } else {
        suggestions.fill(text);
      }
    }, [submit, suggestions, text]);

    return (
      <ActionButton
        ref={ref}
        disabled={disabled ?? !suggestions.isReadyToSend}
        onActivate={handleActivate}
        {...rest}
      />
    );
  },
);
