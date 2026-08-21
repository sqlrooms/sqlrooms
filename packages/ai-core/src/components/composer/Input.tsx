import {Slot, useAutoResizeTextarea} from '@sqlrooms/ui';
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react';
import {mergeHandlers} from '../primitives/mergeHandlers';
import {mergeRefs} from '../primitives/mergeRefs';
import {useChatComposer} from './ChatComposerContext';

/**
 * Whether an IME composition is in progress, so Enter commits the candidate
 * rather than sending. `keyCode === 229` is the legacy signal from engines
 * that don't set `isComposing` (hence the deprecation hint on it).
 */
function isImeComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/**
 * Props for {@link Input}.
 */
export type ChatComposerInputProps = Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'value' | 'defaultValue'
> & {
  /**
   * Render as the single child element instead of a `<textarea>`, via Radix's
   * `Slot`. The child must forward its ref to a real DOM element.
   */
  asChild?: boolean;
  /** Send on Enter with no modifiers. Defaults to `true`. */
  submitOnEnter?: boolean;
  /** Auto-grow to fit content. Defaults to `true`. */
  autoResize?: boolean;
  /**
   * Synchronous pre-send veto, called with the text about to be sent, after
   * the keymap guards pass. Return `false` to abort; any other value proceeds.
   *
   * A merged host `onKeyDown` can only run before or after this component's
   * whole handler — it cannot interpose between "guards passed" and the send,
   * which is where a pre-send hook belongs.
   */
  onBeforeSend?: (text: string) => boolean | void;
};

/**
 * Binds the composer prompt to a text input and owns the Enter-to-send keymap
 * and auto-resize.
 *
 * **Textarea-shaped contract.** Injects `value`, `onChange`, `onKeyDown`,
 * `placeholder`, and `disabled`, and mutates the element's inline `height`
 * when `autoResize` is on. Rich editors — contenteditable, editor-state
 * models, anything with its own keymap — should build on
 * {@link useChatComposer} instead.
 *
 * **The forwarded ref must reach the real DOM node,** or auto-resize silently
 * does nothing: with `asChild`, the child must forward its ref down to the
 * actual `<textarea>`.
 *
 * **Host handlers are merged, not replaced.** A handler passed as a prop runs
 * before this component's own behavior for the same event; calling
 * `event.preventDefault()` suppresses that behavior. This is how a host takes
 * over the keymap, and why `onPaste` passes through untouched.
 */
export const Input = forwardRef<HTMLTextAreaElement, ChatComposerInputProps>(
  function Input(
    {
      asChild,
      submitOnEnter = true,
      autoResize = true,
      onBeforeSend,
      onChange,
      onKeyDown,
      disabled,
      ...rest
    },
    forwardedRef,
  ) {
    const composer = useChatComposer();
    const innerRef = useRef<HTMLTextAreaElement>(null);
    // Memoized: a fresh callback ref would detach and reattach every render.
    const ref = useMemo(
      () => mergeRefs(innerRef, forwardedRef),
      [forwardedRef],
    );

    const {resizeToFitContent} = useAutoResizeTextarea({
      autoResize,
      textareaRef: innerRef,
      value: composer.prompt,
    });

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        composer.setPrompt(event.target.value);
        if (autoResize) resizeToFitContent();
      },
      [composer, autoResize, resizeToFitContent],
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!submitOnEnter) return;
        if (event.key !== 'Enter') return;
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
          return;
        }

        if (isImeComposing(event)) return;

        event.preventDefault();

        // Enter while a run is in flight is a no-op — it must never cancel.
        if (composer.isBusy) return;
        if (!composer.canSend) return;
        if (onBeforeSend?.(composer.prompt) === false) return;
        composer.send();
      },
      [submitOnEnter, composer, onBeforeSend],
    );

    const Comp = asChild ? Slot : 'textarea';

    return (
      <Comp
        ref={ref}
        value={composer.prompt}
        onChange={mergeHandlers(onChange, handleChange)}
        onKeyDown={mergeHandlers(onKeyDown, handleKeyDown)}
        disabled={disabled ?? composer.isBusy}
        {...rest}
      />
    );
  },
);
