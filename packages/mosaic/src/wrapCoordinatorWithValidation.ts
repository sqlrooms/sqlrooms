import {Coordinator} from '@uwdata/mosaic-core';
import {DataPointLimitError} from './DataPointLimitError';

/** Extract row count from Arrow table, array, or Mosaic table. */
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
  if (
    typeof result === 'object' &&
    'toArray' in result &&
    typeof (result as any).toArray === 'function'
  ) {
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

/** Get maxDataPoints from query metadata or coordinator override. Returns undefined if not set. */
function getMaxDataPointsForRequest(
  request: any,
  coordinator: any,
): number | undefined {
  if (!request || typeof request !== 'object') {
    return undefined;
  }

  // Check for client-specific maxDataPoints added by wrapped query
  if (
    '__maxDataPoints' in request &&
    typeof request.__maxDataPoints === 'number'
  ) {
    return request.__maxDataPoints;
  }

  // Check for temporary coordinator override (used by VgPlot charts)
  if (
    coordinator &&
    '__tempMaxDataPoints' in coordinator &&
    typeof coordinator.__tempMaxDataPoints === 'number'
  ) {
    return coordinator.__tempMaxDataPoints;
  }

  return undefined;
}

/** Wrap coordinator query method to validate result sizes against maxDataPoints metadata. */
export function wrapCoordinatorWithValidation(coordinator: Coordinator): void {
  const originalQuery = coordinator.query.bind(coordinator);

  (coordinator as any).query = async function (
    this: any,
    request: any,
    options?: any,
  ) {
    const result = await originalQuery(request, options);

    // Get the maxDataPoints limit for this specific query
    const limit = getMaxDataPointsForRequest(request, this);

    // Skip validation if no limit is set
    if (limit === undefined) {
      return result;
    }

    // Skip validation if limit is Infinity (e.g., maps)
    if (!Number.isFinite(limit)) {
      return result;
    }

    // Validate queries that return table-like data
    const rowCount = getQueryResultRowCount(result);
    if (rowCount > limit) {
      throw new DataPointLimitError(rowCount, limit);
    }

    return result;
  };
}

/** Set temporary maxDataPoints override for VgPlot charts. */
export function setCoordinatorMaxDataPoints(
  coordinator: Coordinator,
  maxDataPoints: number | undefined,
): void {
  if (maxDataPoints !== undefined) {
    (coordinator as any).__tempMaxDataPoints = maxDataPoints;
  } else {
    delete (coordinator as any).__tempMaxDataPoints;
  }
}
