import {formatAggregatorValue} from './aggregators';
import {
  buildPivotCellMap,
  buildPivotTotalsMap,
  buildPivotUniqueKeys,
  compareKeyArrays,
  type HeatmapMode,
  keyId,
  makeHeatColor,
  type PivotArrowTable,
  type PivotCellValue,
  spanSize,
  toNumericValues,
} from './helpers';
import {getColAlias, getRowAlias} from './sql';
import {PivotSliceConfig} from './types';
import React, {useMemo} from 'react';

type TableRendererProps = {
  config: PivotSliceConfig;
  cellRows: PivotArrowTable;
  rowTotals: PivotArrowTable;
  colTotals: PivotArrowTable;
  grandTotal: PivotCellValue;
  heatmapMode?: HeatmapMode;
};

export const TableRenderer: React.FC<TableRendererProps> = ({
  config,
  cellRows,
  rowTotals,
  colTotals,
  grandTotal,
  heatmapMode,
}) => {
  const rowAliases = config.rows.map((_, index) => getRowAlias(index));
  const colAliases = config.cols.map((_, index) => getColAlias(index));

  const rowTotalsMap = useMemo(() => {
    return buildPivotTotalsMap(rowTotals, rowAliases);
  }, [rowAliases, rowTotals]);
  const colTotalsMap = useMemo(() => {
    return buildPivotTotalsMap(colTotals, colAliases);
  }, [colAliases, colTotals]);

  const rowKeys = useMemo(() => {
    const source = (rowTotals?.numRows ?? 0) > 0 ? rowTotals : cellRows;
    const unique = buildPivotUniqueKeys(source, rowAliases);
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
    const source = (colTotals?.numRows ?? 0) > 0 ? colTotals : cellRows;
    const unique = buildPivotUniqueKeys(source, colAliases);
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

  const cellMap = useMemo(() => {
    return buildPivotCellMap(cellRows, rowAliases, colAliases);
  }, [cellRows, colAliases, rowAliases]);

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
                      {formatAggregatorValue(config.aggregatorName, cellValue)}
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
                  {formatAggregatorValue(config.aggregatorName, totalValue)}
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
                  {formatAggregatorValue(config.aggregatorName, totalValue)}
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
