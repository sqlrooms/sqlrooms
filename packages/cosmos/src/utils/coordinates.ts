/**
 * Interface for objects that contain client coordinates.
 * Typically used with mouse or pointer events.
 */
export type WithClientCoordinates = {
  /** The horizontal coordinate relative to the client area */
  clientX: number;
  /** The vertical coordinate relative to the client area */
  clientY: number;
};

/**
 * Type guard that checks if an unknown value has client coordinates.
 *
 * This function performs a runtime check to ensure that an object has valid
 * clientX and clientY number properties. It's useful for handling events
 * that may or may not include coordinate information.
 *
 * @example
 * ```ts
 * const handleEvent = (event: unknown) => {
 *   if (hasClientCoordinates(event)) {
 *     // TypeScript now knows event has clientX and clientY
 *     console.log(event.clientX, event.clientY);
 *   }
 * };
 * ```
 *
 * @param event - The value to check for client coordinates
 * @returns A type predicate indicating if the value has client coordinates
 */
export const hasClientCoordinates = (
  event: unknown,
): event is WithClientCoordinates => {
  return (
    typeof event === 'object' &&
    event !== null &&
    'clientX' in event &&
    'clientY' in event &&
    typeof event.clientX === 'number' &&
    typeof event.clientY === 'number'
  );
};
