import {getAggregatorLabel} from './aggregators';
import {buildRendererTitle} from './sql';
import {PivotSliceConfig} from './types';
import {VisualizationSpec} from '@sqlrooms/vega';
import * as arrow from 'apache-arrow';

/**
 * Optional Arrow table input used by pivot renderers while query results are loading.
 */
export type PivotArrowTable = arrow.Table | undefined;

/**
 * Cell value type produced by pivot queries.
 *
 * Values may be numeric, strings, bigint-backed Arrow scalars, or null-like values
 * depending on the selected aggregator.
 */
export type PivotCellValue = unknown;

type PivotColumn = ReturnType<arrow.Table['getChild']> | undefined;

/**
 * Supported heatmap rendering modes for the pivot table renderer.
 */
export type HeatmapMode = 'full' | 'row' | 'col' | undefined;

/**
 * Sorts two arbitrary values using a null-safe natural string comparison.
 *
 * Numeric substrings are compared numerically so labels like `item2` sort before
 * `item10`.
 */
export function naturalSort(a: unknown, b: unknown) {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return -1;
  }
  if (b === null || b === undefined) {
    return 1;
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Compares two pivot key tuples segment-by-segment using natural sorting.
 */
export function compareKeyArrays(a: string[], b: string[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = naturalSort(a[index] ?? '', b[index] ?? '');
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

/**
 * Encodes a composite pivot key as a stable string suitable for `Map` keys.
 */
export function keyId(key: string[]) {
  return key.join('\u0000');
}

function getPivotKey(columns: PivotColumn[], index: number) {
  return columns.map((column) => String(column?.get(index) ?? ''));
}

/**
 * Builds a lookup of axis totals keyed by the requested row or column aliases.
 *
 * The map values come directly from the Arrow `value` column to avoid converting
 * the result set into row objects first.
 */
export function buildPivotTotalsMap(
  table: PivotArrowTable,
  keyAliases: string[],
): Map<string, PivotCellValue> {
  const keyColumns = keyAliases.map((alias) => table?.getChild(alias));
  const valueColumn = table?.getChild('value');
  const map = new Map<string, PivotCellValue>();
  const rowCount = table?.numRows ?? 0;
  for (let index = 0; index < rowCount; index += 1) {
    map.set(
      keyId(getPivotKey(keyColumns, index)),
      valueColumn?.get(index) ?? null,
    );
  }
  return map;
}

/**
 * Extracts the distinct row or column keys present in a pivot result table.
 *
 * Keys are returned in encounter order so callers can apply their own sorting.
 */
export function buildPivotUniqueKeys(
  table: PivotArrowTable,
  keyAliases: string[],
) {
  const keyColumns = keyAliases.map((alias) => table?.getChild(alias));
  const unique = new Map<string, string[]>();
  const rowCount = table?.numRows ?? 0;
  for (let index = 0; index < rowCount; index += 1) {
    const key = getPivotKey(keyColumns, index);
    unique.set(keyId(key), key);
  }
  return Array.from(unique.values());
}

/**
 * Builds a lookup of pivot cell values keyed by `rowKey::colKey`.
 *
 * This is the main columnar access path used by `TableRenderer`.
 */
export function buildPivotCellMap(
  table: PivotArrowTable,
  rowAliases: string[],
  colAliases: string[],
): Map<string, PivotCellValue> {
  const rowColumns = rowAliases.map((alias) => table?.getChild(alias));
  const colColumns = colAliases.map((alias) => table?.getChild(alias));
  const valueColumn = table?.getChild('value');
  const map = new Map<string, PivotCellValue>();
  const rowCount = table?.numRows ?? 0;
  for (let index = 0; index < rowCount; index += 1) {
    map.set(
      `${keyId(getPivotKey(rowColumns, index))}::${keyId(getPivotKey(colColumns, index))}`,
      valueColumn?.get(index) ?? null,
    );
  }
  return map;
}

/**
 * Returns the unique stringified values for a single Arrow column.
 *
 * Used by export and chart helpers that only need one label column.
 */
export function getUniqueStringColumnValues(
  table: PivotArrowTable,
  columnName: string,
) {
  const column = table?.getChild(columnName);
  const unique = new Set<string>();
  const rowCount = table?.numRows ?? 0;
  for (let index = 0; index < rowCount; index += 1) {
    unique.add(String(column?.get(index) ?? ''));
  }
  return Array.from(unique);
}

/**
 * Calculates the rowspan or colspan for a grouped header cell.
 *
 * Returns `-1` when the cell should be skipped because an earlier header already
 * spans across it.
 */
export function spanSize(
  arr: string[][],
  rowIndex: number,
  columnIndex: number,
) {
  if (rowIndex !== 0) {
    let noDraw = true;
    for (let index = 0; index <= columnIndex; index += 1) {
      if (arr[rowIndex - 1]?.[index] !== arr[rowIndex]?.[index]) {
        noDraw = false;
      }
    }
    if (noDraw) {
      return -1;
    }
  }

  let length = 0;
  while (rowIndex + length < arr.length) {
    let stop = false;
    for (let index = 0; index <= columnIndex; index += 1) {
      if (arr[rowIndex]?.[index] !== arr[rowIndex + length]?.[index]) {
        stop = true;
      }
    }
    if (stop) {
      break;
    }
    length += 1;
  }
  return length;
}

/**
 * Produces a simple red-tinted heatmap background for a numeric value.
 *
 * The value is normalized against the provided scale values.
 */
export function makeHeatColor(value: number | null, values: number[]) {
  if (value === null || values.length === 0) {
    return undefined;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }
  if (min === max) {
    return {backgroundColor: 'rgb(255,220,220)'};
  }
  const nonRed = 255 - Math.round((255 * (value - min)) / (max - min));
  return {backgroundColor: `rgb(255,${nonRed},${nonRed})`};
}

/**
 * Converts a mixed collection of values into the finite numeric subset.
 */
export function toNumericValues(values: unknown[]) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

/**
 * Builds the Vega-Lite spec for chart-based pivot renderers.
 *
 * The generated spec derives display-friendly series/category labels from the
 * pivot result's `row_label` and `col_label` columns.
 */
export function buildChartSpec(
  config: PivotSliceConfig,
  rendererName: PivotSliceConfig['rendererName'],
): VisualizationSpec {
  const fullAggName = getAggregatorLabel(config.aggregatorName, config.vals);
  const defaultSeries = JSON.stringify(fullAggName);
  const defaultCategory = JSON.stringify(' ');
  const rowTitle = config.rows.join(', ') || undefined;
  const colTitle = config.cols.join(', ') || undefined;

  const verticalTransform = [
    {
      calculate: `datum.row_label && datum.row_label !== '' ? datum.row_label : ${defaultSeries}`,
      as: 'series_label',
    },
    {
      calculate: `datum.col_label && datum.col_label !== '' ? datum.col_label : ${defaultCategory}`,
      as: 'category_label',
    },
  ];
  const horizontalTransform = [
    {
      calculate: `datum.col_label && datum.col_label !== '' ? datum.col_label : ${defaultSeries}`,
      as: 'series_label',
    },
    {
      calculate: `datum.row_label && datum.row_label !== '' ? datum.row_label : ${defaultCategory}`,
      as: 'category_label',
    },
  ];

  const tooltip: Array<{
    field: 'row_label' | 'col_label' | 'value';
    type: 'nominal' | 'quantitative';
    title: string;
  }> = [
    {field: 'row_label', type: 'nominal', title: rowTitle ?? 'Rows'},
    {field: 'col_label', type: 'nominal', title: colTitle ?? 'Columns'},
    {field: 'value', type: 'quantitative', title: fullAggName},
  ];

  switch (rendererName) {
    case 'Grouped Column Chart':
      return {
        title: buildRendererTitle(config),
        transform: verticalTransform,
        mark: {type: 'bar'},
        encoding: {
          x: {field: 'category_label', type: 'nominal', title: colTitle},
          xOffset: {field: 'series_label'},
          y: {field: 'value', type: 'quantitative', title: fullAggName},
          color: {field: 'series_label', type: 'nominal', title: rowTitle},
          tooltip,
        },
      };
    case 'Stacked Column Chart':
      return {
        title: buildRendererTitle(config),
        transform: verticalTransform,
        mark: {type: 'bar'},
        encoding: {
          x: {field: 'category_label', type: 'nominal', title: colTitle},
          y: {
            field: 'value',
            type: 'quantitative',
            title: fullAggName,
            stack: 'zero',
          },
          color: {field: 'series_label', type: 'nominal', title: rowTitle},
          tooltip,
        },
      };
    case 'Grouped Bar Chart':
      return {
        title: buildRendererTitle(config, true),
        transform: horizontalTransform,
        mark: {type: 'bar'},
        encoding: {
          y: {field: 'category_label', type: 'nominal', title: rowTitle},
          yOffset: {field: 'series_label'},
          x: {field: 'value', type: 'quantitative', title: fullAggName},
          color: {field: 'series_label', type: 'nominal', title: colTitle},
          tooltip,
        },
      };
    case 'Stacked Bar Chart':
      return {
        title: buildRendererTitle(config, true),
        transform: horizontalTransform,
        mark: {type: 'bar'},
        encoding: {
          y: {field: 'category_label', type: 'nominal', title: rowTitle},
          x: {
            field: 'value',
            type: 'quantitative',
            title: fullAggName,
            stack: 'zero',
          },
          color: {field: 'series_label', type: 'nominal', title: colTitle},
          tooltip,
        },
      };
    case 'Line Chart':
      return {
        title: buildRendererTitle(config),
        transform: verticalTransform,
        mark: {type: 'line', point: true},
        encoding: {
          x: {field: 'category_label', type: 'nominal', title: colTitle},
          y: {field: 'value', type: 'quantitative', title: fullAggName},
          color: {field: 'series_label', type: 'nominal', title: rowTitle},
          tooltip,
        },
      };
    case 'Dot Chart':
      return {
        title: buildRendererTitle(config, true),
        transform: horizontalTransform,
        mark: {type: 'point', filled: true, size: 90},
        encoding: {
          x: {field: 'value', type: 'quantitative', title: fullAggName},
          y: {field: 'category_label', type: 'nominal', title: rowTitle},
          color: {field: 'series_label', type: 'nominal', title: colTitle},
          tooltip,
        },
      };
    case 'Area Chart':
      return {
        title: buildRendererTitle(config),
        transform: verticalTransform,
        mark: {type: 'area', opacity: 0.7},
        encoding: {
          x: {field: 'category_label', type: 'nominal', title: colTitle},
          y: {
            field: 'value',
            type: 'quantitative',
            title: fullAggName,
            stack: 'zero',
          },
          color: {field: 'series_label', type: 'nominal', title: rowTitle},
          tooltip,
        },
      };
    case 'Scatter Chart':
      return {
        title: `${config.rows.join(', ') || 'Rows'} vs ${config.cols.join(', ') || 'Columns'}`,
        mark: {type: 'point', filled: true},
        encoding: {
          x: {field: 'col_label', type: 'nominal', title: colTitle},
          y: {field: 'row_label', type: 'nominal', title: rowTitle},
          size: {field: 'value', type: 'quantitative', title: fullAggName},
          color: {field: 'value', type: 'quantitative', title: fullAggName},
          tooltip,
        },
      };
    case 'Multiple Pie Chart':
      return {
        title: buildRendererTitle(config, true),
        transform: horizontalTransform,
        facet: {field: 'series_label', type: 'nominal', title: colTitle},
        columns: 3,
        spec: {
          mark: {type: 'arc', innerRadius: 24},
          encoding: {
            theta: {field: 'value', type: 'quantitative'},
            color: {field: 'category_label', type: 'nominal', title: rowTitle},
            tooltip,
          },
        },
      };
    default:
      return {
        title: buildRendererTitle(config),
        transform: verticalTransform,
        mark: {type: 'bar'},
        encoding: {
          x: {field: 'category_label', type: 'nominal'},
          y: {field: 'value', type: 'quantitative'},
          color: {field: 'series_label', type: 'nominal'},
          tooltip,
        },
      };
  }
}
