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
 * Inside a controlled `Root`, both `aria-pressed` and the toggle follow that
 * root's `open`/`onOpenChange` instead of the store it overrides, so the
 * reported state cannot contradict what is rendered.
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
