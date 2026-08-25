import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {usePromptSuggestions} from './ChatSuggestionsContext';
import {useControlledVisibility} from './controlledVisibility';

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
 *
 * Inside a controlled `Root`, writes through that root's `onOpenChange` rather
 * than the store it overrides. Note that such a root renders nothing while
 * hidden, so a toggle *inside* one can only ever close it and `aria-pressed`
 * is always `true` there — {@link Dismiss} says that more plainly. Render the
 * toggle outside the root for a control that can also re-open it.
 */
export const VisibilityToggle = forwardRef<
  HTMLButtonElement,
  ChatSuggestionsVisibilityToggleProps
>(function VisibilityToggle({'aria-pressed': ariaPressed, ...rest}, ref) {
  const suggestions = usePromptSuggestions();
  const controlled = useControlledVisibility();
  const visible = controlled?.visible ?? suggestions.visible;

  const handleActivate = useCallback(() => {
    if (controlled) controlled.setVisible(!controlled.visible);
    else suggestions.toggle();
  }, [controlled, suggestions]);

  return (
    <ActionButton
      ref={ref}
      aria-pressed={ariaPressed ?? visible}
      onActivate={handleActivate}
      {...rest}
    />
  );
});
