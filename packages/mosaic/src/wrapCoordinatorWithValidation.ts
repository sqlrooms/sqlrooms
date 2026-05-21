import {Coordinator} from '@uwdata/mosaic-core';
import {DataPointLimitError} from './DataPointLimitError';

/**
 * Extract row count from various query result formats.
 *
 * Supports three result shapes:
 * 1. Arrow table objects with a numeric `numRows` property
 * 2. Plain arrays (uses `.length`)
 * 3. Mosaic table-like objects exposing a `toArray()` method
 *
 * @param result - Query result in any of the supported formats
 * @returns The number of rows, or 0 if the result is empty or unrecognized
 */
function getQueryResultRowCount(result: unknown): number {
  if (!result) return 0;

  // Arrow table format
  if (typeof result === 'object' && 'numRows' in result) {
    return (result as any).numRows ?? 0;
  }

  // Array format
  if (Array.isArray(result)) {
    return result.length;
  }

  // Mosaic table format with toArray
  if (typeof result === 'object' && 'toArray' in result) {
    const arr = (result as any).toArray();
    return Array.isArray(arr) ? arr.length : 0;
  }

  // Unrecognized format
  console.warn(
    'getQueryResultRowCount: unrecognized result format, expected Arrow table (numRows), array, or Mosaic table (toArray)',
    result,
  );
  return 0;
}

/**
 * Wraps coordinator's query method to validate result sizes.
 * This prevents rendering charts with too many data points.
 */
export function wrapCoordinatorWithValidation(
  coordinator: Coordinator,
  maxDataPoints: number,
): void {
  const originalQuery = coordinator.query.bind(coordinator);

  (coordinator as any).query = async function (request: any, options?: any) {
    const result = await originalQuery(request, options);

    // Validate all queries that return data
    const rowCount = getQueryResultRowCount(result);
    if (rowCount > maxDataPoints) {
      throw new DataPointLimitError(rowCount, maxDataPoints);
    }

    return result;
  };
}
