/**
 * Merges a host-supplied event handler with a primitive's own handler for the
 * same event, host-first: the host runs first, and calling
 * `event.preventDefault()` suppresses the primitive's behavior.
 *
 * Lets a host take over a keymap or veto a change without a per-event opt-out
 * prop.
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
