import {Slot} from '@sqlrooms/ui';
import {forwardRef, type ComponentPropsWithoutRef} from 'react';
import {mergeHandlers} from './mergeHandlers';

/**
 * Props for {@link ActionButton}.
 */
export type ActionButtonProps = ComponentPropsWithoutRef<'button'> & {
  /** Render as the single child element instead of a `<button>`, via Radix's `Slot`. */
  asChild?: boolean;
  /** The primitive's own click behavior, merged after any host `onClick`. */
  onActivate: () => void;
};

/**
 * Shared shell for the action primitives (send, stop, suggestion item,
 * visibility toggle, dismiss): renders a `<button>` or an `asChild` slot and
 * merges the host's `onClick` ahead of `onActivate`.
 *
 * `type="button"` is supplied in both cases, so a substituted `<button>` child
 * that sets no type of its own does not fall back to `submit` and post the
 * enclosing form — silently losing a draft. `Slot` gives child props
 * precedence, so a child that sets its own `type` keeps it, and a caller
 * whose `asChild` child is not a `<button>` can pass `type={undefined}` to
 * suppress the attribute entirely.
 *
 * Internal — each primitive wraps this with its own state and naming.
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({asChild, onActivate, onClick, ...rest}, ref) {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type="button"
        onClick={mergeHandlers(onClick, onActivate)}
        {...rest}
      />
    );
  },
);
