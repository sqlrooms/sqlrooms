import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {mergeHandlers} from '../composer/mergeHandlers';
import {usePromptSuggestions} from './ChatSuggestionsContext';

/**
 * Props for {@link Item}.
 */
export type ChatSuggestionsItemProps = ComponentPropsWithoutRef<'button'> & {
  /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
  asChild?: boolean;
  /** The suggestion's text. */
  text: string;
  /**
   * When `true`, activation sends `text` immediately instead of filling it
   * into the prompt. Defaults to `false` (fill), so existing consumers of
   * this primitive are unaffected by the recipe layer opting into submit.
   *
   * Submitting reuses {@link useChatComposer}'s `send`, so — matching fill's
   * existing semantics — it **overwrites a non-empty draft** rather than
   * appending to or confirming over it.
   */
  submit?: boolean;
};

/**
 * A single suggestion. On activation, fills the composer's prompt with
 * `text` by default, or sends it immediately when `submit` is passed.
 * Disabled whenever sending is not currently possible ({@link
 * useChatComposer}'s `canSend`, read here through {@link
 * usePromptSuggestions}), regardless of whether this item fills or submits —
 * so a suggestion list and the send control can never disagree about
 * readiness.
 *
 * Carries no width, height, truncation, or tooltip — the host places, sizes,
 * and labels it.
 */
export const Item = forwardRef<HTMLButtonElement, ChatSuggestionsItemProps>(
  function Item(
    {asChild, text, submit = false, onClick, disabled, ...rest},
    ref,
  ) {
    const suggestions = usePromptSuggestions();

    const handleClick = useCallback(() => {
      if (submit) {
        suggestions.send(text);
      } else {
        suggestions.fill(text);
      }
    }, [submit, suggestions, text]);

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        disabled={disabled ?? !suggestions.canSend}
        onClick={mergeHandlers(onClick, handleClick)}
        {...rest}
      />
    );
  },
);
