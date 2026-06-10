import type {Spec} from '@uwdata/mosaic-spec';
import {HistogramChartSettings, DEFAULT_BINS_COUNT} from './schema';
import {CreateSpecOptions} from '../base-types';
import {
  InvalidColumnTypeError,
  MissingColumnsError,
  RequiredFieldsError,
} from '../errors';
import {isQuantitativeType} from '../../../column-types-utils';
import {TableColumn} from '@sqlrooms/duckdb';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

export function createHistogramSpec(
  options: CreateSpecOptions<HistogramChartSettings>,
): Spec {
  const {dataTable, selectionName} = options;

  const {fieldColumn, maxBins} = validateHistogramSettings(options);

  const plot: unknown[] = [
    {
      mark: 'rectY',
      data: {from: dataTable.table.table},
      x: {bin: fieldColumn.name, steps: maxBins},
      y: {count: null},
      fill: BG_COLOR,
      inset: 0.5,
    },
    {
      mark: 'rectY',
      data: {from: dataTable.table.table, filterBy: '$brush'},
      x: {bin: fieldColumn.name, steps: maxBins},
      y: {count: null},
      fill: FG_COLOR,
      inset: 0.5,
    },
  ];

  if (selectionName) {
    plot.push({select: 'intervalX', as: '$brush'});
  }

  return {
    plot,
    xLabel: fieldColumn.name,
    yLabel: 'Count',
    height: 200,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

type ValidatedHistogramSettings = {
  fieldColumn: TableColumn;
  maxBins: number;
};

function validateHistogramSettings({
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
