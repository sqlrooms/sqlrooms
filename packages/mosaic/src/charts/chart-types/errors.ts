/**
 * Base error class for chart specification generation errors.
 */
export class ChartSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartSpecError';
  }
}

export class RequiredFieldsError extends ChartSpecError {
  readonly fieldNames: string[];

  constructor(fieldNames: string | string[]) {
    super('Required fields are missing');

    this.fieldNames = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    this.name = 'RequiredFieldsError';
  }
}

export class MissingColumnsError extends ChartSpecError {
  readonly columnNames: string[];

  constructor(columnNames: string | string[]) {
    super('Columns not found in data table');

    this.columnNames = Array.isArray(columnNames) ? columnNames : [columnNames];
    this.name = 'MissingColumnsError';
  }
}

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
