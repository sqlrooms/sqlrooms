import {Coordinator} from '@uwdata/mosaic-core';
import {DataPointLimitError} from './DataPointLimitError';
import {getQueryResultRowCount} from './chart-runtime';

/**
 * Wraps coordinator's query method to validate result sizes.
 * This prevents rendering charts with too many data points.
 *
 * @deprecated Prefer chart-owned `ChartDataPolicy` validation in renderer
 * query-result lifecycles. A coordinator-wide limit cannot distinguish raw
 * point charts from aggregate charts.
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
