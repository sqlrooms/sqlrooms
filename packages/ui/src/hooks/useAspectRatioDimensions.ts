import {RefObject, useMemo} from 'react';
import {useResizeObserver} from 'usehooks-ts';

/**
 * Represents the dimensions of an element
 * @interface Dimensions
 * @property {number} width - The width in pixels
 * @property {number} height - The height in pixels
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Props for the useAspectRatioDimensions hook
 * @interface UseAspectRatioDimensionsProps
 * @property {number | 'auto'} width - The explicitly provided width, or 'auto' for container-based width
 * @property {number | 'auto'} height - The explicitly provided height, or 'auto' for aspect ratio-based height
 * @property {number} aspectRatio - The desired width-to-height ratio when dimensions are auto-calculated
 * @property {React.RefObject<HTMLElement>} containerRef - Reference to the container element
 */
export interface UseAspectRatioDimensionsProps {
  width: number | 'auto';
  height: number | 'auto';
  aspectRatio?: number;
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * A hook that calculates element dimensions based on provided values and container size
 *
 * This hook handles various combinations of width/height specifications:
 * - If both width and height are provided, uses those exact dimensions
 * - If only width is provided, calculates height using the aspect ratio
 * - If only height is provided, calculates width using the aspect ratio
 * - If both are 'auto', uses container width and calculates height using the aspect ratio
 *
 * @param {UseAspectRatioDimensionsProps} props - The input parameters for dimension calculation
 * @returns {Dimensions} The calculated width and height
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const {width, height} = useAspectRatioDimensions({
 *   width: 'auto',
 *   height: 'auto',
 *   aspectRatio: 16/9,
 *   containerRef
 * });
 * // Returns dimensions based on container size
 * ```
 */
export function useAspectRatioDimensions({
  width,
  height,
  aspectRatio,
  containerRef,
}: UseAspectRatioDimensionsProps): Dimensions {
  const {width: containerWidth = 0, height: containerHeight = 0} =
    useResizeObserver({
      ref: containerRef as RefObject<HTMLElement>,
      box: 'border-box',
    });

  return useMemo(() => {
    if (!aspectRatio) {
      return {width: containerWidth, height: containerHeight};
    }
    if (width !== 'auto' && height !== 'auto') {
      return {width, height};
    }
    if (width !== 'auto') {
      return {width, height: width / aspectRatio};
    }
    if (height !== 'auto') {
      return {width: height * aspectRatio, height};
    }
    const finalWidth = containerWidth;
    const finalHeight = finalWidth / aspectRatio;
    return {width: finalWidth, height: finalHeight};
  }, [containerWidth, containerHeight, aspectRatio, width, height]);
}
