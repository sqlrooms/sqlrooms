import {LineChartSettings} from './schema';
import {ValidateSpecOptions} from '../base-types';
import {
  ChartSpecError,
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isNumericType, isQuantitativeType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';
import {AggregateFunction, TemporalInterval} from '../../../schemas';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';

export type ValidatedLineChartSettings = {
  metric: 'aggregate' | 'count';
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
  settings: {x, yFields = [], xInterval, metric = 'aggregate'},
}: ValidateSpecOptions<LineChartSettings>): ValidatedLineChartSettings {
  // Basic validation for required fields
  if (!x || (metric === 'aggregate' && yFields.length === 0)) {
    throw new RequiredFieldsError([
      ...(x ? [] : ['X-axis']),
      ...(metric === 'count' || yFields.length > 0 ? [] : ['Y-axis']),
    ]);
  }

  // Validate X and Y field existence
  const xColumn = dataTable.columns.find((col) => col.name === x);
  if (!xColumn) throw new MissingColumnsError(['X-axis']);
  if (!isQuantitativeType(xColumn.type)) {
    throw new InvalidColumnTypeError(xColumn.name, 'quantitative');
  }
  if (metric === 'count') {
    if (yFields.length > 0) {
      throw new ChartSpecError(
        'Row counts use COUNT(*). Omit yFields when metric is count; use metric aggregate for numeric series.',
      );
    }
    return {metric, xColumn, yColumns: [], xInterval};
  }
  const yColumns = yFields.map((y) => ({
    field: y.field,
    column: dataTable.columns.find((col) => col.name === y.field),
    aggregate: y.aggregate ?? 'sum',
    color: y.color ?? DEFAULT_CHART_FALLBACK_COLOR,
  }));

  const missingYColumns = yColumns.filter((y) => !y.column);

  if (missingYColumns.length > 0) {
    throw new MissingColumnsError(missingYColumns.map((y) => y.field));
  }

  // Validate X and Y field types
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
    metric,
    xColumn,
    yColumns,
    xInterval,
  } as ValidatedLineChartSettings;
}
