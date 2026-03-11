import {DataTable, useSql} from '@sqlrooms/duckdb';
import {ErrorPane, SpinnerPane} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import React, {useMemo} from 'react';
import {getDefaultValuesForAggregator} from './aggregators';
import {
  buildChartSpec,
  getUniqueStringColumnValues,
  type HeatmapMode,
} from './helpers';
import {
  buildCellsQuery,
  buildColTotalsQuery,
  buildGrandTotalQuery,
  buildPivotExportQuery,
  buildRowTotalsQuery,
} from './sql';
import {TableRenderer} from './TableRenderer';
import {TsvRenderer} from './TsvRenderer';
import {PivotSliceConfig} from './types';

type PivotResultsProps = {
  config: PivotSliceConfig;
  table: DataTable;
};

type PivotRow = Record<string, unknown>;

export const PivotResults: React.FC<PivotResultsProps> = ({config, table}) => {
  const resolvedConfig = useMemo(() => {
    const nextVals = getDefaultValuesForAggregator({
      aggregatorName: config.aggregatorName,
      fields: table.columns
        .filter((column) => !config.hiddenFromAggregators.includes(column.name))
        .map((column) => ({name: column.name, type: column.type})),
      currentValues: config.vals,
    });

    if (JSON.stringify(nextVals) === JSON.stringify(config.vals)) {
      return config;
    }

    return {
      ...config,
      vals: nextVals,
    };
  }, [config, table.columns]);

  const cellsQuery = useMemo(
    () => buildCellsQuery(resolvedConfig, table),
    [resolvedConfig, table],
  );
  const rowTotalsQuery = useMemo(
    () => buildRowTotalsQuery(resolvedConfig, table),
    [resolvedConfig, table],
  );
  const colTotalsQuery = useMemo(
    () => buildColTotalsQuery(resolvedConfig, table),
    [resolvedConfig, table],
  );
  const grandTotalQuery = useMemo(
    () => buildGrandTotalQuery(resolvedConfig, table),
    [resolvedConfig, table],
  );

  const cellsResult = useSql<PivotRow>({query: cellsQuery});
  const rowTotalsResult = useSql<PivotRow>({query: rowTotalsQuery});
  const colTotalsResult = useSql<PivotRow>({query: colTotalsQuery});
  const grandTotalResult = useSql<PivotRow>({query: grandTotalQuery});

  const grandTotal = useMemo(() => {
    return grandTotalResult.data?.arrowTable?.getChild('value')?.get(0) ?? null;
  }, [grandTotalResult.data?.arrowTable]);

  const chartRenderer = resolvedConfig.rendererName.includes('Chart');
  const numericOutput = !['List Unique Values', 'First', 'Last'].includes(
    resolvedConfig.aggregatorName,
  );
  const chartSpec = useMemo(
    () => buildChartSpec(resolvedConfig, resolvedConfig.rendererName),
    [resolvedConfig],
  );
  const chartExportQuery = useMemo(() => {
    const colLabels = getUniqueStringColumnValues(
      cellsResult.data?.arrowTable,
      'col_label',
    );
    return buildPivotExportQuery(resolvedConfig, table, colLabels);
  }, [cellsResult.data?.arrowTable, resolvedConfig, table]);

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

  if (resolvedConfig.rendererName === 'Exportable TSV') {
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
    resolvedConfig.rendererName === 'Table Heatmap'
      ? 'full'
      : resolvedConfig.rendererName === 'Table Row Heatmap'
        ? 'row'
        : resolvedConfig.rendererName === 'Table Col Heatmap'
          ? 'col'
          : undefined;

  return (
    <TableRenderer
      config={resolvedConfig}
      cellRows={cellsResult.data?.arrowTable}
      rowTotals={rowTotalsResult.data?.arrowTable}
      colTotals={colTotalsResult.data?.arrowTable}
      grandTotal={grandTotal}
      heatmapMode={heatmapMode}
    />
  );
};
