export const MAX_DATA_POINTS = 10000;

/**
 * Custom error class for data point limit exceeded.
 */
export class DataPointLimitError extends Error {
  constructor(
    public readonly rowCount: number,
    public readonly limit: number = MAX_DATA_POINTS,
  ) {
    super(
      `This chart would render ${rowCount.toLocaleString()} data points (limit: ${limit.toLocaleString()})`,
    );
    this.name = 'DataPointLimitError';
  }
}
