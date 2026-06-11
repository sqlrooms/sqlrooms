import {CountPlotChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isCategoricalType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

export type ValidatedCountPlotSettings = {
  fieldColumn: TableColumn;
};

export function validateCountPlotSettings({
  dataTable,
  settings: {field},
}: CreateSpecOptions<CountPlotChartSettings>): ValidatedCountPlotSettings {
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

  return {
    fieldColumn,
  };
}
