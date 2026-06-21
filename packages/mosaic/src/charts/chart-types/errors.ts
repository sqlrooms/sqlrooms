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
 * Error thrown when required chart configuration fields are missing.
 * Used during chart validation to indicate which fields must be provided.
 */
export class RequiredFieldsError extends ChartSpecError {
  readonly fieldNames: string[];

  constructor(fieldNames: string | string[]) {
    super('Required fields are missing');

    this.fieldNames = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    this.name = 'RequiredFieldsError';
  }
}

/**
 * Error thrown when chart configuration references columns that don't exist in the data table.
 * Used during chart validation to indicate which columns could not be found.
 */
export class MissingColumnsError extends ChartSpecError {
  readonly columnNames: string[];

  constructor(columnNames: string | string[]) {
    super('Columns not found in data table');

    this.columnNames = Array.isArray(columnNames) ? columnNames : [columnNames];
    this.name = 'MissingColumnsError';
  }
}

/**
 * Error thrown when chart configuration uses columns with incompatible data types.
 * Used during chart validation to indicate which columns have invalid types and what type is expected.
 */
export class InvalidColumnTypeError extends ChartSpecError {
  readonly columnNames: string[];
  readonly expectedType: string;

  constructor(columnNames: string[] | string, expectedType: string) {
    super('Invalid column type');

    this.columnNames = Array.isArray(columnNames) ? columnNames : [columnNames];
    this.expectedType = expectedType;

    this.name = 'InvalidColumnTypeError';
  }
}

/**
 * Error thrown when attempting to create a chart that would render too many data points.
 * Used to prevent browser crashes from non-aggregated charts on large datasets.
 */
export class TooMuchDataError extends ChartSpecError {
  readonly chartType: string;
  readonly rowCount: number;
  readonly maxDataPoints: number;

  constructor(chartType: string, rowCount: number, maxDataPoints: number) {
    super(
      `Cannot create ${chartType} with ${rowCount.toLocaleString()} rows. ` +
        `This chart type renders individual data points and is limited to ${maxDataPoints.toLocaleString()} rows. ` +
        `Use an aggregated visualization instead (histogram, heatmap, or line chart with time intervals).`,
    );

    this.chartType = chartType;
    this.rowCount = rowCount;
    this.maxDataPoints = maxDataPoints;
    this.name = 'TooMuchDataError';
  }
}
