import {ScatterPlotChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isNumericType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

export type ValidatedScatterPlotSettings = {
  xColumn: TableColumn;
  yColumn: TableColumn;
  sizeColumn?: TableColumn;
};

export function validateScatterPlotSettings({
  dataTable,
  settings: {x, y, size},
}: ValidateSpecOptions<ScatterPlotChartSettings>): ValidatedScatterPlotSettings {
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

  // Validate size field if provided
  let sizeColumn = undefined;
  if (size) {
    sizeColumn = dataTable.columns.find((col) => col.name === size);
    if (!sizeColumn) {
      throw new MissingColumnsError([size]);
    }
    if (!isNumericType(sizeColumn.type)) {
      throw new InvalidColumnTypeError([sizeColumn.name], 'numeric');
    }
  }

  return {
    xColumn,
    yColumn,
    sizeColumn,
  };
}
