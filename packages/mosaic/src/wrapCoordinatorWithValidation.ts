import {Coordinator} from '@uwdata/mosaic-core';
import {DataPointLimitError, MAX_DATA_POINTS} from './DataPointLimitError';

/**
 * Extract row count from various query result formats.
 * Supports Arrow tables, arrays, and Mosaic tables.
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

  return 0;
}

/**
 * Wraps coordinator's query method to validate result sizes.
 * This prevents rendering charts with too many data points.
 */
export function wrapCoordinatorWithValidation(
  coordinator: Coordinator,
  maxDataPoints: number = MAX_DATA_POINTS,
): void {
  const originalQuery = coordinator.query.bind(coordinator);

  (coordinator as any).query = async function (request: any, options?: any) {
    const result = await originalQuery(request, options);

    // Validate all queries that return data
    // Skip validation for small helper queries (scales, legends, etc.)
    const rowCount = getQueryResultRowCount(result);
    if (rowCount > maxDataPoints) {
      throw new DataPointLimitError(rowCount, maxDataPoints);
    }

    return result;
  };
}
