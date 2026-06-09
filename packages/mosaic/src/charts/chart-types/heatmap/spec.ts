import type {Spec} from '@uwdata/mosaic-spec';
import {HeatmapChartSettings} from './schema';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {CreateSpecOptions} from '../base-types';
import {isNumericType} from '../../../column-types-utils';

export function createHeatmapSpec(
  options: CreateSpecOptions<HeatmapChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {xColumn, yColumn} = validateHeatmapSettings(options);

  const plot: unknown[] = [
    {
      mark: 'raster',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: xColumn.name,
      y: yColumn.name,
      fill: 'density',
      bandwidth: 0,
      pixelSize: 3,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalXY', as: '$brush'});
  }

  return {
    plot,
    colorScale: 'sqrt',
    colorScheme: 'ylorrd',
    xLabel: xColumn.name,
    yLabel: yColumn.name,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

function validateHeatmapSettings({
  dataTable,
  settings: {x, y},
}: CreateSpecOptions<HeatmapChartSettings>) {
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
  if (!isNumericType(xColumn.type) || !isNumericType(yColumn.type)) {
    throw new InvalidColumnTypeError(
      [
        ...(!isNumericType(xColumn.type) ? [xColumn.name] : []),
        ...(!isNumericType(yColumn.type) ? [yColumn.name] : []),
      ],
      'numeric',
    );
  }

  return {
    xColumn,
    yColumn,
  };
}
