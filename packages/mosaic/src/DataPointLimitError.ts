/**
 * Custom error class for data point limit exceeded.
 */
export class DataPointLimitError extends Error {
  constructor(
    public readonly rowCount: number,
    public readonly limit: number,
  ) {
    super(
      `This chart would render ${rowCount.toLocaleString()} data points (limit: ${limit.toLocaleString()})`,
    );
    this.name = 'DataPointLimitError';
  }
}
