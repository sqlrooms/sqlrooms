import {ChartSpecError} from './errors';
import {isNumericType} from '../../column-types-utils';
import type {AggregateFunction} from '../../schemas';
import {DataTable} from '@sqlrooms/db';

/**
 * Validates that a field exists in the data table
 * @throws {ChartSpecError} if field is not found
 */
export function validateFieldExists(
  dataTable: DataTable,
  field: string,
  fieldLabel: string,
): void {
  const column = dataTable.columns.find((col) => col.name === field);
  if (!column) {
    throw new ChartSpecError(
      `${fieldLabel} "${field}" not found in data table`,
    );
  }
}

/**
 * Validates that a field exists and returns the column
 * @throws {ChartSpecError} if field is not found
 */
export function getValidatedColumn(
  dataTable: DataTable,
  field: string,
  fieldLabel: string,
) {
  const column = dataTable.columns.find((col) => col.name === field);
  if (!column) {
    throw new ChartSpecError(
      `${fieldLabel} "${field}" not found in data table`,
    );
  }
  return column;
}

/**
 * Validates that aggregation can be applied to the given field type
 * @throws {ChartSpecError} if aggregation is not applicable
 */
export function validateAggregation(
  dataTable: DataTable,
  field: string,
  aggregate: AggregateFunction,
  fieldLabel: string,
): void {
  const column = dataTable.columns.find((col) => col.name === field);
  if (!column) {
    throw new ChartSpecError(
      `${fieldLabel} "${field}" not found in data table`,
    );
  }

  // All current aggregations (sum, avg, min, max) require numeric types
  if (!isNumericType(column.type)) {
    throw new ChartSpecError(
      `Aggregation "${aggregate}" cannot be applied to non-numeric field "${field}" (type: ${column.type})`,
    );
  }
}
