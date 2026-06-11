import {LineChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isNumericType, isQuantitativeType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/db';
import {AggregateFunction, TemporalInterval} from '../../../schemas';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';

export type ValidatedLineChartSettings = {
  xColumn: TableColumn;
  yColumns: {
    field: string;
    column: TableColumn;
    aggregate: AggregateFunction;
    color: string;
  }[];
  xInterval?: TemporalInterval;
};

export function validateLineChartSettings({
  dataTable,
  settings: {x, yFields = [], xInterval},
}: ValidateSpecOptions<LineChartSettings>): ValidatedLineChartSettings {
  // Basic validation for required fields
  if (!x || yFields.length === 0) {
    throw new RequiredFieldsError([
      ...(x ? [] : ['X-axis']),
      ...(yFields.length > 0 ? [] : ['Y-axis']),
    ]);
  }

  // Validate X and Y field existence
  const xColumn = dataTable.columns.find((col) => col.name === x);
  const yColumns = yFields.map((y) => ({
    field: y.field,
    column: dataTable.columns.find((col) => col.name === y.field),
    aggregate: y.aggregate ?? 'sum',
    color: y.color ?? DEFAULT_CHART_FALLBACK_COLOR,
  }));

  const missingYColumns = yColumns.filter((y) => !y.column);

  if (!xColumn || missingYColumns.length > 0) {
    throw new MissingColumnsError([
      ...(xColumn ? [] : ['X-axis']),
      ...missingYColumns.map((y) => y.field),
    ]);
  }

  // Validate X and Y field types
  if (!isQuantitativeType(xColumn.type)) {
    throw new InvalidColumnTypeError(xColumn.name, 'quantitative');
  }

  const invalidYFields = yColumns.filter((y) => {
    return y.column && !isNumericType(y.column.type);
  });

  if (invalidYFields.length > 0) {
    throw new InvalidColumnTypeError(
      invalidYFields.map(({field}) => field),
      'numeric',
    );
  }

  return {
    xColumn,
    yColumns,
    xInterval,
  } as ValidatedLineChartSettings;
}
