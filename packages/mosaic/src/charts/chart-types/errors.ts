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
