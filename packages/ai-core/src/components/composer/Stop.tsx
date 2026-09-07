import {forwardRef, useCallback} from 'react';
import {ActionButton, type ActionButtonProps} from '../primitives/ActionButton';
import {useChatComposer} from './ChatComposerContext';

/**
 * Props for {@link Stop}.
 */
export type ChatComposerStopProps = Omit<ActionButtonProps, 'onActivate'>;

/**
 * Cancels the in-flight run on activation.
 *
 * **Self-hiding:** renders `null` while idle — use {@link Send} for that
 * state. Never disabled: stopping is always available once a run is in
 * flight.
 */
export const Stop = forwardRef<HTMLButtonElement, ChatComposerStopProps>(
  function Stop(props, ref) {
    const composer = useChatComposer();

    const handleActivate = useCallback(() => {
      composer.cancel();
    }, [composer]);

    if (!composer.isRunning) return null;

    return <ActionButton ref={ref} onActivate={handleActivate} {...props} />;
  },
);
