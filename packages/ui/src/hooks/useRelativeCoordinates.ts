import {useCallback} from 'react';

/**
 * A hook that converts absolute screen coordinates to coordinates relative to a container element.
 *
 * This hook is useful when you need to position elements (like tooltips, popovers, or context menus)
 * relative to a container, especially when dealing with mouse or touch events.
 *
 * @param containerRef - A React ref object pointing to the container HTML element
 * @returns A callback function that converts absolute coordinates to relative ones
 *
 * @example
 * ```typescript
 * const MyComponent = () => {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const getRelativeCoords = useRelativeCoordinates(containerRef);
 *
 *   const handleMouseMove = (e: React.MouseEvent) => {
 *     // Convert screen coordinates to container-relative coordinates
 *     const [relativeX, relativeY] = getRelativeCoords(e.clientX, e.clientY);
 *
 *     // Use the coordinates to position a tooltip, etc.
 *     setTooltipPosition({ x: relativeX, y: relativeY });
 *   };
 *
 *   return (
 *     <div
 *       ref={containerRef}
 *       onMouseMove={handleMouseMove}
 *       className="relative"
 *     >
 *       Content
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using with touch events
 * const handleTouch = (e: React.TouchEvent) => {
 *   const touch = e.touches[0];
 *   const [x, y] = getRelativeCoords(touch.clientX, touch.clientY);
 *   // Position elements based on touch coordinates
 * };
 * ```
 */
export const useRelativeCoordinates = (
  containerRef: React.RefObject<HTMLElement | null>,
) => {
  return useCallback(
    (x: number, y: number): [number, number] => {
      if (!containerRef.current) return [0, 0];
      const rect = containerRef.current.getBoundingClientRect();
      return [x - rect.left, y - rect.top];
    },
    [containerRef],
  );
};
