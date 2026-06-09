import type {Spec} from '@uwdata/mosaic-spec';
import {LineChartSettings} from './schema';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {
  isNumericType,
  isQuantitativeType,
  isTemporalType,
} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/db';
import {AggregateFunction, TemporalInterval} from '../../../schemas';

// Chart color palette matching theme colors from tailwind-preset.css
const CHART_COLORS = [
  '#ea7c5c', // chart-1: hsl(12, 76%, 61%)
  '#2a9d8f', // chart-2: hsl(173, 58%, 39%)
  '#264653', // chart-3: hsl(197, 37%, 24%)
  '#e9c46a', // chart-4: hsl(43, 74%, 66%)
  '#f4a261', // chart-5: hsl(27, 87%, 67%)
];

function getLineColor(color: string | undefined, index: number): string {
  if (color) {
    return color;
  }
  // CHART_COLORS is non-empty, so this is always defined
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export function createLineChartSpec(
  options: CreateSpecOptions<LineChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumns, xInterval} = validateLineChartSettings(options);

  const isXTemporal = isTemporalType(xColumn.type);

  const plotMarks: unknown[] = [];

  // Data source always includes filterBy for brush
  const dataSource = {from: dataTable.table.table, filterBy: '$brush'};

  // Generate lineY and text marks for each Y field
  yColumns.forEach((yColumn, index) => {
    const color = getLineColor(yColumn.color, index);
    const aggregate = yColumn.aggregate || 'sum';

    // When temporal aggregation is active, use bin for X and aggregation for Y
    if (isXTemporal && xInterval) {
      // Use bin syntax for temporal aggregation
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x: {bin: xColumn.name, interval: xInterval},
        y: {[aggregate]: yColumn.column.name},
        stroke: color,
      });

      // Text label with aggregation info
      plotMarks.push({
        mark: 'text',
        data: dataSource,
        x: {bin: xColumn.name, interval: xInterval},
        y: {[aggregate]: yColumn.column.name},
        text: [`${yColumn.column.name} (${aggregate})`],
        fill: color,
        dx: 5,
        dy: -5,
      });
    } else {
      // No aggregation - direct field references
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x: xColumn.name,
        y: yColumn.column.name,
        stroke: color,
      });

      plotMarks.push({
        mark: 'text',
        data: dataSource,
        x: xColumn.name,
        y: yColumn.column.name,
        text: [yColumn.column.name],
        fill: color,
        dx: 5,
        dy: -5,
      });
    }
  });

  // Add brush control only if selectionName is provided
  if (selectionName) {
    plotMarks.push({select: 'intervalX', as: '$brush'});
  }

  return {
    plot: plotMarks,
    xLabel: xColumn.name,
    yLabel: undefined,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

type ValidatedLineChartSettings = {
  xColumn: TableColumn;
  yColumns: {
    field: string;
    column: TableColumn;
    aggregate?: AggregateFunction;
    color?: string;
  }[];
  xInterval?: TemporalInterval;
};

function validateLineChartSettings({
  dataTable,
  settings: {x, yFields = [], xInterval},
}: CreateSpecOptions<LineChartSettings>): ValidatedLineChartSettings {
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
    aggregate: y.aggregate,
    color: y.color,
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
