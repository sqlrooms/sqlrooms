import {HeatmapChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isNumericType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

export type ValidatedHeatmapSettings = {
  xColumn: TableColumn;
  yColumn: TableColumn;
};

export function validateHeatmapSettings({
  dataTable,
  settings: {x, y},
}: ValidateSpecOptions<HeatmapChartSettings>): ValidatedHeatmapSettings {
  // Basic validation for required fields
  if (!x || !y) {
    throw new RequiredFieldsError([
      ...(x ? [] : ['X field']),
      ...(y ? [] : ['Y field']),
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

  // Validate X and Y field are numeric
  const xIsNumeric = isNumericType(xColumn.type);
  const yIsNumeric = isNumericType(yColumn.type);
  if (!xIsNumeric || !yIsNumeric) {
    throw new InvalidColumnTypeError(
      [
        ...(!xIsNumeric ? [xColumn.name] : []),
        ...(!yIsNumeric ? [yColumn.name] : []),
      ],
      'numeric',
    );
  }

  return {
    xColumn,
    yColumn,
  };
}
