/**
 * Base error class for chart specification generation errors.
 */
export class ChartSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartSpecError';
  }
}

/**
 * Error thrown when spec generation fails due to invalid settings or other issues.
 * Chart definitions should throw this error from their createSpec function.
 *
 * @example
 * ```ts
 * createSpec: (tableName, {field}) => {
 *   if (!field) {
 *     throw new SpecGenerationError('Field is required');
 *   }
 *   // ... generate spec
 * }
 * ```
 */
export class SpecGenerationError extends ChartSpecError {}

/**
 * Error thrown when table name is missing.
 */
export class MissingTableError extends ChartSpecError {
  constructor() {
    super('Please select a data table first');
  }
}

/**
 * Error thrown when chart type is unknown.
 */
export class UnknownChartTypeError extends ChartSpecError {
  constructor(public readonly chartType: string) {
    super('This chart type is not supported');
  }
}
