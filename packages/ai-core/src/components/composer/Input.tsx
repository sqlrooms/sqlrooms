import {Slot, useAutoResizeTextarea} from '@sqlrooms/ui';
import {
  forwardRef,
  useCallback,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react';
import {useChatComposer} from './ChatComposerContext';
import {mergeHandlers} from './mergeHandlers';
import {mergeRefs} from './mergeRefs';

/**
 * Props for {@link Input}.
 */
export type ChatComposerInputProps = Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'value' | 'defaultValue'
> & {
  /**
   * Render as the single child element instead of a `<textarea>`, via
   * Radix's `Slot`. The child must forward its ref to a real DOM element —
   * see the caveat in {@link Input}'s tsdoc.
   */
  asChild?: boolean;
  /** Send on Enter with no modifiers. Defaults to `true`. */
  submitOnEnter?: boolean;
  /** Auto-grow to fit content. Defaults to `true`. */
  autoResize?: boolean;
};

/**
 * Binds the composer prompt to a text input and owns the Enter-to-send
 * keymap and auto-resize.
 *
 * **Textarea-shaped contract.** `Input` injects `value`, `onChange`,
 * `onKeyDown`, `placeholder`, and `disabled`, and mutates its element's
 * inline `height` when `autoResize` is on. This is the right shape for a
 * plain textarea or a textarea-like host component. It is **not** a fit for
 * rich editors — contenteditable surfaces, editor-state models, or anything
 * with its own keymap — because those don't expose a single value/onChange
 * pair or a DOM node whose inline height can be mutated safely. Build those
 * directly on {@link useChatComposer} instead.
 *
 * **The forwarded ref must reach the real DOM node.** Auto-resize measures
 * and mutates the textarea's inline height through the ref this component
 * receives. When `asChild` is used, that ref flows through Radix's `Slot` to
 * the child element — so the child (or the host component it renders) must
 * forward its ref down to the actual `<textarea>`. A component that accepts
 * a `ref` prop but does not forward it will silently get no auto-grow, with
 * no error and nothing to catch it in a type check.
 *
 * **Host handlers are merged, not replaced.** Every handler passed as a prop
 * (`onChange`, `onKeyDown`, `onPaste`, and so on) runs alongside this
 * component's own behavior for that same event. Where this component owns
 * behavior for an event, the host's handler runs first; if it calls
 * `event.preventDefault()`, this component's own behavior for that event is
 * suppressed. This is how `submitOnEnter` can be effectively overridden by a
 * host that wants full control of the keymap, and it is why `onPaste` is
 * left untouched today — carried through for future attachment support.
 */
export const Input = forwardRef<HTMLTextAreaElement, ChatComposerInputProps>(
  function Input(
    {
      asChild,
      submitOnEnter = true,
      autoResize = true,
      onChange,
      onKeyDown,
      disabled,
      ...rest
    },
    forwardedRef,
  ) {
    const composer = useChatComposer();
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const ref = mergeRefs(innerRef, forwardedRef);

    const {resizeToFitContent} = useAutoResizeTextarea({
      autoResize,
      textareaRef: innerRef,
      value: composer.prompt,
      defaultValue: undefined,
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

        // Guard IME composition: committing a CJK candidate with Enter must
        // not also send. `keyCode === 229` covers older engines that don't
        // set `isComposing`.
        const nativeEvent = event.nativeEvent as unknown as {
          isComposing?: boolean;
        };
        const legacyKeyCode = (event as unknown as {keyCode?: number}).keyCode;
        if (nativeEvent.isComposing || legacyKeyCode === 229) return;

        event.preventDefault();

        // Enter while a run is in flight is a no-op — it must never cancel.
        if (composer.isBusy) return;
        if (!composer.canSend) return;
        composer.send();
      },
      [submitOnEnter, composer],
    );

    const mergedOnChange = mergeHandlers(onChange, handleChange);
    const mergedOnKeyDown = mergeHandlers(onKeyDown, handleKeyDown);

    const Comp = asChild ? Slot : 'textarea';

    return (
      <Comp
        ref={ref}
        value={composer.prompt}
        onChange={mergedOnChange}
        onKeyDown={mergedOnKeyDown}
        disabled={disabled ?? composer.isBusy}
        {...rest}
      />
    );
  },
);
