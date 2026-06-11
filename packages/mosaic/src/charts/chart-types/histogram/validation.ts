import {HistogramChartSettings, DEFAULT_BINS_COUNT} from './schema';
import {CreateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isQuantitativeType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

export type ValidatedHistogramSettings = {
  fieldColumn: TableColumn;
  maxBins: number;
};

export function validateHistogramSettings({
  dataTable,
  settings: {field, maxBins = DEFAULT_BINS_COUNT},
}: CreateSpecOptions<HistogramChartSettings>): ValidatedHistogramSettings {
  // Basic validation for required fields
  if (!field) {
    throw new RequiredFieldsError('Field');
  }

  // Validate field existence and type
  const fieldColumn = dataTable.columns.find((col) => col.name === field);

  if (!fieldColumn) {
    throw new MissingColumnsError(field);
  }

  if (!isQuantitativeType(fieldColumn.type)) {
    throw new InvalidColumnTypeError(fieldColumn.name, 'quantitative');
  }

  return {
    fieldColumn,
    maxBins,
  };
}
