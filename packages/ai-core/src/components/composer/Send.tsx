import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {useChatComposer} from './ChatComposerContext';
import {mergeHandlers} from './mergeHandlers';

/**
 * Props for {@link Send}.
 */
export type ChatComposerSendProps = ComponentPropsWithoutRef<'button'> & {
  /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
  asChild?: boolean;
  /**
   * Synchronous pre-send veto, called immediately before the prompt is sent.
   * Return `false` to abort the send; any other return value proceeds.
   *
   * Preferred over signalling a veto by calling `preventDefault()` on the
   * click, which reads as an obscure idiom for "do not send". Deliberately
   * synchronous, matching {@link Input}'s seam.
   */
  onBeforeSend?: () => boolean | void;
};

/**
 * Sends the current prompt on activation.
 *
 * **Self-hiding:** this component renders nothing (`null`) while a run is in
 * flight — use {@link Stop} for the running state. Disabled whenever sending
 * is not currently possible ({@link useChatComposer}'s `canSend`). If a send
 * control appears to vanish from the composer, this is why: it is hidden,
 * not merely disabled, whenever a response is streaming.
 */
export const Send = forwardRef<HTMLButtonElement, ChatComposerSendProps>(
  function Send({asChild, onBeforeSend, onClick, disabled, ...rest}, ref) {
    const composer = useChatComposer();

    const handleClick = useCallback(() => {
      if (onBeforeSend?.() === false) return;
      composer.send();
    }, [composer, onBeforeSend]);

    if (composer.isRunning) return null;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        disabled={disabled ?? !composer.canSend}
        onClick={mergeHandlers(onClick, handleClick)}
        {...rest}
      />
    );
  },
);
