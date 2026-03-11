import {arrowTableToJson, DataTable, useSql} from '@sqlrooms/duckdb';
import {ErrorPane, SpinnerPane, Textarea} from '@sqlrooms/ui';
import {VegaLiteChart, VisualizationSpec} from '@sqlrooms/vega';
import React, {useMemo} from 'react';
import {
  formatAggregatorValue,
  getAggregatorLabel,
  getPivotAggregator,
} from './aggregators';
import {
  buildCellsQuery,
  buildColTotalsQuery,
  buildGrandTotalQuery,
  buildPivotExportQuery,
  buildRendererTitle,
  buildRowTotalsQuery,
  getColAlias,
  getRowAlias,
} from './sql';
import {PivotSliceConfig} from './types';

type PivotResultsProps = {
  config: PivotSliceConfig;
  table: DataTable;
};

type PivotJsonRow = Record<string, unknown>;

type HeatmapMode = 'full' | 'row' | 'col' | undefined;

function naturalSort(a: unknown, b: unknown) {
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

function compareKeyArrays(a: string[], b: string[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = naturalSort(a[index] ?? '', b[index] ?? '');
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

function keyId(key: string[]) {
  return key.join('\u0000');
}

function extractKey(row: PivotJsonRow, aliases: string[]) {
  return aliases.map((alias) => String(row[alias] ?? ''));
}

function spanSize(arr: string[][], rowIndex: number, columnIndex: number) {
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

function makeHeatColor(value: number | null, values: number[]) {
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

function toNumericValues(values: unknown[]) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function buildChartSpec(
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

const TableRenderer: React.FC<{
  config: PivotSliceConfig;
  cellRows: PivotJsonRow[];
  rowTotals: PivotJsonRow[];
  colTotals: PivotJsonRow[];
  grandTotal: number | string | null;
  heatmapMode?: HeatmapMode;
}> = ({config, cellRows, rowTotals, colTotals, grandTotal, heatmapMode}) => {
  const rowAliases = config.rows.map((_, index) => getRowAlias(index));
  const colAliases = config.cols.map((_, index) => getColAlias(index));

  const rowTotalsMap = useMemo(
    () =>
      new Map(
        rowTotals.map((row) => [
          keyId(extractKey(row, rowAliases)),
          row.value ?? null,
        ]),
      ),
    [rowAliases, rowTotals],
  );
  const colTotalsMap = useMemo(
    () =>
      new Map(
        colTotals.map((row) => [
          keyId(extractKey(row, colAliases)),
          row.value ?? null,
        ]),
      ),
    [colAliases, colTotals],
  );

  const rowKeys = useMemo(() => {
    const source = rowTotals.length > 0 ? rowTotals : cellRows;
    const keys = source.map((row) => extractKey(row, rowAliases));
    const unique = Array.from(
      new Map(keys.map((key) => [keyId(key), key])).values(),
    );
    if (unique.length === 0) {
      unique.push([]);
    }
    unique.sort((left, right) => {
      if (config.rowOrder === 'key_a_to_z') {
        return compareKeyArrays(left, right);
      }
      const leftValue = Number(rowTotalsMap.get(keyId(left)) ?? 0);
      const rightValue = Number(rowTotalsMap.get(keyId(right)) ?? 0);
      return config.rowOrder === 'value_a_to_z'
        ? leftValue - rightValue
        : rightValue - leftValue;
    });
    return unique;
  }, [cellRows, config.rowOrder, rowAliases, rowTotals, rowTotalsMap]);

  const colKeys = useMemo(() => {
    const source = colTotals.length > 0 ? colTotals : cellRows;
    const keys = source.map((row) => extractKey(row, colAliases));
    const unique = Array.from(
      new Map(keys.map((key) => [keyId(key), key])).values(),
    );
    if (unique.length === 0) {
      unique.push([]);
    }
    unique.sort((left, right) => {
      if (config.colOrder === 'key_a_to_z') {
        return compareKeyArrays(left, right);
      }
      const leftValue = Number(colTotalsMap.get(keyId(left)) ?? 0);
      const rightValue = Number(colTotalsMap.get(keyId(right)) ?? 0);
      return config.colOrder === 'value_a_to_z'
        ? leftValue - rightValue
        : rightValue - leftValue;
    });
    return unique;
  }, [cellRows, colAliases, colTotals, colTotalsMap, config.colOrder]);

  const cellMap = useMemo(
    () =>
      new Map(
        cellRows.map((row) => [
          `${keyId(extractKey(row, rowAliases))}::${keyId(extractKey(row, colAliases))}`,
          row.value ?? null,
        ]),
      ),
    [cellRows, colAliases, rowAliases],
  );

  const valueScale = useMemo(
    () => toNumericValues(Array.from(cellMap.values())),
    [cellMap],
  );
  const rowScale = useMemo(
    () => toNumericValues(Array.from(colTotalsMap.values())),
    [colTotalsMap],
  );
  const colScale = useMemo(
    () => toNumericValues(Array.from(rowTotalsMap.values())),
    [rowTotalsMap],
  );

  return (
    <div className="bg-background overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/60">
          {config.cols.map((label, columnIndex) => (
            <tr key={`col-attr-${label}`}>
              {columnIndex === 0 && config.rows.length > 0 ? (
                <th
                  colSpan={config.rows.length}
                  rowSpan={config.cols.length}
                  className="border px-3 py-2"
                />
              ) : null}
              <th className="border px-3 py-2 text-left font-medium">
                {label}
              </th>
              {colKeys.map((colKey, keyIndex) => {
                const span = spanSize(colKeys, keyIndex, columnIndex);
                if (span === -1) {
                  return null;
                }
                return (
                  <th
                    key={`col-key-${keyIndex}-${columnIndex}`}
                    colSpan={span}
                    rowSpan={
                      columnIndex === config.cols.length - 1 &&
                      config.rows.length > 0
                        ? 2
                        : 1
                    }
                    className="border px-3 py-2 text-center font-medium"
                  >
                    {colKey[columnIndex] || ' '}
                  </th>
                );
              })}
              {columnIndex === 0 ? (
                <th
                  rowSpan={
                    config.cols.length + (config.rows.length === 0 ? 0 : 1)
                  }
                  className="border px-3 py-2 text-right font-medium"
                >
                  Totals
                </th>
              ) : null}
            </tr>
          ))}
          {config.rows.length > 0 ? (
            <tr>
              {config.rows.map((label) => (
                <th
                  key={`row-label-${label}`}
                  className="border px-3 py-2 text-left font-medium"
                >
                  {label}
                </th>
              ))}
              <th className="border px-3 py-2 text-right font-medium">
                {config.cols.length === 0 ? 'Totals' : null}
              </th>
            </tr>
          ) : null}
        </thead>
        <tbody>
          {rowKeys.map((rowKey, rowIndex) => {
            const totalValue = rowTotalsMap.get(keyId(rowKey)) ?? grandTotal;
            return (
              <tr key={`row-${keyId(rowKey)}`}>
                {rowKey.map((segment, segmentIndex) => {
                  const span = spanSize(rowKeys, rowIndex, segmentIndex);
                  if (span === -1) {
                    return null;
                  }
                  return (
                    <th
                      key={`row-key-${rowIndex}-${segmentIndex}`}
                      rowSpan={span}
                      colSpan={
                        segmentIndex === config.rows.length - 1 &&
                        config.cols.length > 0
                          ? 2
                          : 1
                      }
                      className="bg-muted/40 border px-3 py-2 text-left font-medium"
                    >
                      {segment || ' '}
                    </th>
                  );
                })}
                {colKeys.map((colKey) => {
                  const cellValue =
                    cellMap.get(`${keyId(rowKey)}::${keyId(colKey)}`) ?? null;
                  const numericValue = Number(cellValue);
                  const style =
                    heatmapMode === 'full'
                      ? makeHeatColor(
                          Number.isFinite(numericValue) ? numericValue : null,
                          valueScale,
                        )
                      : heatmapMode === 'row'
                        ? makeHeatColor(
                            Number.isFinite(numericValue) ? numericValue : null,
                            toNumericValues(
                              colKeys.map(
                                (currentColKey) =>
                                  cellMap.get(
                                    `${keyId(rowKey)}::${keyId(currentColKey)}`,
                                  ) ?? null,
                              ),
                            ),
                          )
                        : heatmapMode === 'col'
                          ? makeHeatColor(
                              Number.isFinite(numericValue)
                                ? numericValue
                                : null,
                              toNumericValues(
                                rowKeys.map(
                                  (currentRowKey) =>
                                    cellMap.get(
                                      `${keyId(currentRowKey)}::${keyId(colKey)}`,
                                    ) ?? null,
                                ),
                              ),
                            )
                          : undefined;
                  return (
                    <td
                      key={`${keyId(rowKey)}-${keyId(colKey)}`}
                      className="border px-3 py-2 text-right"
                      style={style}
                    >
                      {formatAggregatorValue(
                        config.aggregatorName,
                        cellValue as number | string | null,
                      )}
                    </td>
                  );
                })}
                <td
                  className="bg-muted/30 border px-3 py-2 text-right font-semibold"
                  style={
                    heatmapMode
                      ? makeHeatColor(Number(totalValue), colScale)
                      : undefined
                  }
                >
                  {formatAggregatorValue(
                    config.aggregatorName,
                    totalValue as number | string | null,
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <th
              colSpan={config.rows.length + (config.cols.length === 0 ? 0 : 1)}
              className="bg-muted/40 border px-3 py-2 text-right font-semibold"
            >
              Totals
            </th>
            {colKeys.map((colKey) => {
              const totalValue = colTotalsMap.get(keyId(colKey)) ?? grandTotal;
              return (
                <td
                  key={`col-total-${keyId(colKey)}`}
                  className="bg-muted/30 border px-3 py-2 text-right font-semibold"
                  style={
                    heatmapMode
                      ? makeHeatColor(Number(totalValue), rowScale)
                      : undefined
                  }
                >
                  {formatAggregatorValue(
                    config.aggregatorName,
                    totalValue as number | string | null,
                  )}
                </td>
              );
            })}
            <td className="bg-muted/30 border px-3 py-2 text-right font-bold">
              {formatAggregatorValue(config.aggregatorName, grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const TsvRenderer: React.FC<{
  query: string;
}> = ({query}) => {
  const exportResult = useSql({query, enabled: Boolean(query)});
  const value = useMemo(() => {
    if (!exportResult.data?.arrowTable) {
      return '';
    }
    const rows = arrowTableToJson(
      exportResult.data.arrowTable,
    ) as PivotJsonRow[];
    const headers = exportResult.data.arrowTable.schema.fields.map(
      (field) => field.name,
    );
    return [
      headers.join('\t'),
      ...rows.map((row) =>
        headers.map((header) => String(row[header] ?? '')).join('\t'),
      ),
    ].join('\n');
  }, [exportResult.data?.arrowTable]);

  if (exportResult.error) {
    return <ErrorPane error={exportResult.error} />;
  }
  if (exportResult.isLoading) {
    return <SpinnerPane className="h-80" />;
  }

  return (
    <Textarea className="min-h-80 font-mono text-xs" readOnly value={value} />
  );
};

export const PivotResults: React.FC<PivotResultsProps> = ({config, table}) => {
  const cellsQuery = useMemo(
    () => buildCellsQuery(config, table),
    [config, table],
  );
  const rowTotalsQuery = useMemo(
    () => buildRowTotalsQuery(config, table),
    [config, table],
  );
  const colTotalsQuery = useMemo(
    () => buildColTotalsQuery(config, table),
    [config, table],
  );
  const grandTotalQuery = useMemo(
    () => buildGrandTotalQuery(config, table),
    [config, table],
  );

  const cellsResult = useSql({query: cellsQuery});
  const rowTotalsResult = useSql({query: rowTotalsQuery});
  const colTotalsResult = useSql({query: colTotalsQuery});
  const grandTotalResult = useSql({query: grandTotalQuery});

  const cellRows = useMemo(
    () =>
      cellsResult.data?.arrowTable
        ? (arrowTableToJson(cellsResult.data.arrowTable) as PivotJsonRow[])
        : [],
    [cellsResult.data?.arrowTable],
  );
  const rowTotals = useMemo(
    () =>
      rowTotalsResult.data?.arrowTable
        ? (arrowTableToJson(rowTotalsResult.data.arrowTable) as PivotJsonRow[])
        : [],
    [rowTotalsResult.data?.arrowTable],
  );
  const colTotals = useMemo(
    () =>
      colTotalsResult.data?.arrowTable
        ? (arrowTableToJson(colTotalsResult.data.arrowTable) as PivotJsonRow[])
        : [],
    [colTotalsResult.data?.arrowTable],
  );

  const grandTotal = useMemo(() => {
    const rows = grandTotalResult.data?.arrowTable
      ? (arrowTableToJson(grandTotalResult.data.arrowTable) as PivotJsonRow[])
      : [];
    return (rows[0]?.value ?? null) as number | string | null;
  }, [grandTotalResult.data?.arrowTable]);

  const chartRenderer = config.rendererName.includes('Chart');
  const numericOutput = !['List Unique Values', 'First', 'Last'].includes(
    config.aggregatorName,
  );
  const chartSpec = useMemo(
    () => buildChartSpec(config, config.rendererName),
    [config],
  );
  const chartExportQuery = useMemo(() => {
    const colLabels = Array.from(
      new Set(cellRows.map((row) => String(row.col_label ?? ''))),
    );
    return buildPivotExportQuery(config, table, colLabels);
  }, [cellRows, config, table]);

  if (
    cellsResult.error ||
    rowTotalsResult.error ||
    colTotalsResult.error ||
    grandTotalResult.error
  ) {
    return (
      <ErrorPane
        error={
          cellsResult.error ||
          rowTotalsResult.error ||
          colTotalsResult.error ||
          grandTotalResult.error ||
          new Error('Unknown pivot error')
        }
      />
    );
  }

  if (
    cellsResult.isLoading ||
    rowTotalsResult.isLoading ||
    colTotalsResult.isLoading ||
    grandTotalResult.isLoading
  ) {
    return <SpinnerPane className="h-80" />;
  }

  if (config.rendererName === 'Exportable TSV') {
    return <TsvRenderer query={chartExportQuery} />;
  }

  if (chartRenderer) {
    if (!numericOutput) {
      return (
        <ErrorPane
          error={
            new Error('The selected renderer requires a numeric aggregation.')
          }
        />
      );
    }

    return (
      <div className="bg-background rounded-md border p-4">
        <VegaLiteChart.ArrowChart
          aspectRatio={16 / 8}
          arrowTable={cellsResult.data?.arrowTable}
          spec={chartSpec}
        />
      </div>
    );
  }

  const heatmapMode: HeatmapMode =
    config.rendererName === 'Table Heatmap'
      ? 'full'
      : config.rendererName === 'Table Row Heatmap'
        ? 'row'
        : config.rendererName === 'Table Col Heatmap'
          ? 'col'
          : undefined;

  return (
    <TableRenderer
      config={config}
      cellRows={cellRows}
      rowTotals={rowTotals}
      colTotals={colTotals}
      grandTotal={grandTotal}
      heatmapMode={heatmapMode}
    />
  );
};
