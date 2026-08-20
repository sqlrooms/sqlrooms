/**
 * Merges a host-supplied event handler with a primitive's own handler for the
 * same event, host-first: the host handler runs first, and if it calls
 * `event.preventDefault()` the primitive's own behavior is suppressed.
 *
 * This is how a host takes over a keymap or veto's a change without the
 * primitive needing a separate opt-out prop for every event it owns.
 */
export function mergeHandlers<E extends {defaultPrevented: boolean}>(
  hostHandler: ((event: E) => void) | undefined,
  ownHandler: (event: E) => void,
): (event: E) => void {
  return (event: E) => {
    hostHandler?.(event);
    if (event.defaultPrevented) return;
    ownHandler(event);
  };
}
