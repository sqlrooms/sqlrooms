import {BoxPlotChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isCategoricalType, isNumericType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

export type ValidatedBoxPlotSettings = {
  xColumn: TableColumn;
  yColumn: TableColumn;
};

export function validateBoxPlotSettings({
  dataTable,
  settings: {x, y},
}: ValidateSpecOptions<BoxPlotChartSettings>): ValidatedBoxPlotSettings {
  // Basic validation for required fields
  if (!x || !y) {
    throw new RequiredFieldsError([
      ...(x ? [] : ['X field (categorical)']),
      ...(y ? [] : ['Y field (numeric)']),
    ]);
  }

  // Validate X and Y field existence
  const xColumn = dataTable.columns.find((col) => col.name === x);
  const yColumn = dataTable.columns.find((col) => col.name === y);

  if (!xColumn || !yColumn) {
    throw new MissingColumnsError([
      ...(xColumn ? [] : [x]),
      ...(yColumn ? [] : [y]),
    ]);
  }

  // Validate X is categorical and Y is numeric
  if (!isCategoricalType(xColumn.type)) {
    throw new InvalidColumnTypeError(xColumn.name, 'categorical');
  }

  if (!isNumericType(yColumn.type)) {
    throw new InvalidColumnTypeError(yColumn.name, 'numeric');
  }

  return {
    xColumn,
    yColumn,
  };
}
