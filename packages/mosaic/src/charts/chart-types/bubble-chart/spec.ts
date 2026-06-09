import type {Spec} from '@uwdata/mosaic-spec';
import {BubbleChartSettings} from './schema';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {isNumericType} from '../../../column-types-utils';

const FG_COLOR = 'var(--color-chart-1)';

export function createBubbleChartSpec(
  options: CreateSpecOptions<BubbleChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumn} = validateBubbleChartSettings(options);

  const plot: unknown[] = [
    {
      mark: 'dot',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: xColumn.name,
      y: yColumn.name,
      fill: FG_COLOR,
      fillOpacity: 0.5,
      r: 3,
    },
  ];

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

function validateBubbleChartSettings({
  dataTable,
  settings: {x, y},
}: CreateSpecOptions<BubbleChartSettings>) {
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
