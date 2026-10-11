import {CountPlotChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isCategoricalType, isNumericType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';
import {AggregateFunction} from '../../../schemas';

export type ValidatedCountPlotSettings = {
  fieldColumn: TableColumn;
  metric: 'count' | 'aggregate';
  valueColumn?: TableColumn;
  aggregate: AggregateFunction;
};

export function validateCountPlotSettings({
  dataTable,
  settings: {aggregate = 'sum', field, metric = 'count', valueField},
}: ValidateSpecOptions<CountPlotChartSettings>): ValidatedCountPlotSettings {
  // Basic validation for required fields
  if (!field) {
    throw new RequiredFieldsError('Field');
  }

  // Validate field existence and type
  const fieldColumn = dataTable.columns.find((col) => col.name === field);

  if (!fieldColumn) {
    throw new MissingColumnsError(field);
  }

  if (!isCategoricalType(fieldColumn.type)) {
    throw new InvalidColumnTypeError(fieldColumn.name, 'categorical');
  }

  if (metric === 'count') {
    return {
      fieldColumn,
      aggregate,
      metric,
    };
  }

  if (!valueField) {
    throw new RequiredFieldsError('Value field');
  }

  const valueColumn = dataTable.columns.find((col) => col.name === valueField);

  if (!valueColumn) {
    throw new MissingColumnsError(valueField);
  }

  if (!isNumericType(valueColumn.type)) {
    throw new InvalidColumnTypeError(valueColumn.name, 'numeric');
  }

  return {
    aggregate,
    fieldColumn,
    metric,
    valueColumn,
  };
}
