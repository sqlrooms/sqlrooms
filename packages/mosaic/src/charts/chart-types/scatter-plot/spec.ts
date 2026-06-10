import type {Spec} from '@uwdata/mosaic-spec';
import {ScatterPlotChartSettings} from './schema';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {isNumericType} from '../../../column-types-utils';

const FG_COLOR = 'var(--color-chart-1)';
const DEFAULT_POINT_SIZE = 3;

export function createScatterPlotSpec(
  options: CreateSpecOptions<ScatterPlotChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumn, sizeColumn} = validateScatterPlotSettings(options);

  const dotMark: Record<string, unknown> = {
    mark: 'dot',
    data: {from: dataTable.table.table, filterBy: '$brush'},
    x: xColumn.name,
    y: yColumn.name,
    fill: FG_COLOR,
    fillOpacity: 0.5,
  };

  // If size column is provided, use it for point radius; otherwise use fixed size
  if (sizeColumn) {
    dotMark.r = sizeColumn.name;
  } else {
    dotMark.r = DEFAULT_POINT_SIZE;
  }

  const plot: unknown[] = [dotMark];

  if (selectionName) {
    plot.push({select: 'intervalXY', as: '$brush'});
  }

  return {
    plot,
    xLabel: xColumn.name,
    yLabel: yColumn.name,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

function validateScatterPlotSettings({
  dataTable,
  settings: {x, y, size},
}: CreateSpecOptions<ScatterPlotChartSettings>) {
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
