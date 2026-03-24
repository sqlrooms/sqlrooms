import {useSql} from '@sqlrooms/duckdb';
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
  createPivotQuerySourceFromTable,
} from './sql';
import {TableRenderer} from './TableRenderer';
import {TsvRenderer} from './TsvRenderer';
import {
  type PivotConfig,
  type PivotQuerySource,
  type PivotRelationViews,
} from './types';

type PivotResultsProps = {
  config: PivotConfig;
  source?: PivotQuerySource;
  table?: Parameters<typeof createPivotQuerySourceFromTable>[0];
  relations?: PivotRelationViews;
  runState?: 'idle' | 'running' | 'success' | 'cancel' | 'error';
  stale?: boolean;
  lastError?: string;
};

type PivotRow = Record<string, unknown>;

export const PivotResults: React.FC<PivotResultsProps> = ({
  config,
  source,
  table,
  relations,
  runState,
  stale,
  lastError,
}) => {
  const querySource = useMemo(
    () =>
      source ?? (table ? createPivotQuerySourceFromTable(table) : undefined),
    [source, table],
  );
  const resolvedConfig = useMemo(() => {
    const nextVals = getDefaultValuesForAggregator({
      aggregatorName: config.aggregatorName,
      fields: (querySource?.columns ?? []).filter(
        (column) => !config.hiddenFromAggregators.includes(column.name),
      ),
      currentValues: config.vals,
    });

    if (JSON.stringify(nextVals) === JSON.stringify(config.vals)) {
      return config;
    }

    return {
      ...config,
      vals: nextVals,
    };
  }, [config, querySource?.columns]);

  const directCellsQuery = useMemo(
    () => (querySource ? buildCellsQuery(resolvedConfig, querySource) : ''),
    [querySource, resolvedConfig],
  );
  const directRowTotalsQuery = useMemo(
    () => (querySource ? buildRowTotalsQuery(resolvedConfig, querySource) : ''),
    [querySource, resolvedConfig],
  );
  const directColTotalsQuery = useMemo(
    () => (querySource ? buildColTotalsQuery(resolvedConfig, querySource) : ''),
    [querySource, resolvedConfig],
  );
  const directGrandTotalQuery = useMemo(
    () =>
      querySource ? buildGrandTotalQuery(resolvedConfig, querySource) : '',
    [querySource, resolvedConfig],
  );

  const materializedRelations = useMemo(
    () =>
      !querySource && runState === 'success' && !stale ? relations : undefined,
    [querySource, relations, runState, stale],
  );

  const matCells = materializedRelations?.cells;
  const matRowTotals = materializedRelations?.rowTotals;
  const matColTotals = materializedRelations?.colTotals;
  const matGrandTotal = materializedRelations?.grandTotal;
  const matExport = materializedRelations?.export;

  const cellsQuery = useMemo(
    () => (matCells ? `SELECT * FROM ${matCells}` : directCellsQuery),
    [directCellsQuery, matCells],
  );
  const rowTotalsQuery = useMemo(
    () =>
      matRowTotals ? `SELECT * FROM ${matRowTotals}` : directRowTotalsQuery,
    [directRowTotalsQuery, matRowTotals],
  );
  const colTotalsQuery = useMemo(
    () =>
      matColTotals ? `SELECT * FROM ${matColTotals}` : directColTotalsQuery,
    [directColTotalsQuery, matColTotals],
  );
  const grandTotalQuery = useMemo(
    () =>
      matGrandTotal ? `SELECT * FROM ${matGrandTotal}` : directGrandTotalQuery,
    [directGrandTotalQuery, matGrandTotal],
  );

  const enabled = Boolean(
    matCells || matRowTotals || matColTotals || matGrandTotal || querySource,
  );
  const cellsResult = useSql<PivotRow>({query: cellsQuery, enabled});
  const rowTotalsResult = useSql<PivotRow>({query: rowTotalsQuery, enabled});
  const colTotalsResult = useSql<PivotRow>({query: colTotalsQuery, enabled});
  const grandTotalResult = useSql<PivotRow>({query: grandTotalQuery, enabled});

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
  const cellsArrowTable = cellsResult.data?.arrowTable;
  const chartExportQuery = useMemo(() => {
    const colLabels = getUniqueStringColumnValues(cellsArrowTable, 'col_label');
    if (matExport) {
      return `SELECT * FROM ${matExport}`;
    }
    return querySource
      ? buildPivotExportQuery(resolvedConfig, querySource, colLabels)
      : '';
  }, [cellsArrowTable, matExport, querySource, resolvedConfig]);

  if (!enabled) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        Select a pivot source to preview results.
      </div>
    );
  }

  if (runState === 'error' && lastError) {
    return <ErrorPane error={new Error(lastError)} />;
  }

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
