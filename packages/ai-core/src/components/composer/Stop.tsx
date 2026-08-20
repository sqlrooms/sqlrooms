import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {useChatComposer} from './ChatComposerContext';
import {mergeHandlers} from './mergeHandlers';

/**
 * Props for {@link Stop}.
 */
export type ChatComposerStopProps = ComponentPropsWithoutRef<'button'> & {
  /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
  asChild?: boolean;
};

/**
 * Cancels the in-flight run on activation.
 *
 * **Self-hiding:** this component renders nothing (`null`) while idle — use
 * {@link Send} for that state. Never disabled: stopping a response is always
 * available once a run is in flight. If a stop control appears to vanish
 * from the composer, this is why: it is hidden, not merely disabled,
 * whenever nothing is running.
 */
export const Stop = forwardRef<HTMLButtonElement, ChatComposerStopProps>(
  function Stop({asChild, onClick, ...rest}, ref) {
    const composer = useChatComposer();

    const handleClick = useCallback(() => {
      composer.cancel();
    }, [composer]);

    if (!composer.isRunning) return null;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        onClick={mergeHandlers(onClick, handleClick)}
        {...rest}
      />
    );
  },
);
