import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {useChatComposer} from './ChatComposerContext';

/**
 * Props for {@link Send}.
 */
export type ChatComposerSendProps = Omit<ActionButtonProps, 'onActivate'> & {
  /**
   * Synchronous pre-send veto, called with the text about to be sent.
   * Return `false` to abort; any other value proceeds.
   *
   * Preferred over calling `preventDefault()` on the click, which reads as an
   * obscure idiom for "do not send". Synchronous, matching {@link Input}'s
   * seam.
   */
  onBeforeSend?: (text: string) => boolean | void;
};

/**
 * Sends the current prompt on activation.
 *
 * **Self-hiding:** renders `null` while a run is in flight — use {@link Stop}
 * for that state. Disabled whenever {@link useChatComposer}'s `canSend` is
 * false.
 */
export const Send = forwardRef<HTMLButtonElement, ChatComposerSendProps>(
  function Send({onBeforeSend, disabled, ...rest}, ref) {
    const composer = useChatComposer();

    const handleActivate = useCallback(() => {
      if (onBeforeSend?.(composer.prompt) === false) return;
      composer.send();
    }, [composer, onBeforeSend]);

    if (composer.isRunning) return null;

    return (
      <ActionButton
        ref={ref}
        disabled={disabled ?? !composer.canSend}
        onActivate={handleActivate}
        {...rest}
      />
    );
  },
);
