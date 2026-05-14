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
