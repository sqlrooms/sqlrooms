import {useSql} from '@sqlrooms/duckdb';
import {ErrorPane, SpinnerPane} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import React, {useMemo} from 'react';
import {
  buildChartSpec,
  getUniqueStringColumnValues,
  type HeatmapMode,
} from './helpers';
import {buildPivotExportQuery} from './sql';
import {TableRenderer} from './TableRenderer';
import {TsvRenderer} from './TsvRenderer';
import {PivotConfig, PivotRelations} from './types';

type PivotResultsProps = {
  config: PivotConfig;
  relations?: PivotRelations;
};

type PivotRow = Record<string, unknown>;

export const PivotResults: React.FC<PivotResultsProps> = ({
  config,
  relations,
}) => {
  const cellsQuery = useMemo(
    () =>
      relations?.cellsRelation
        ? `SELECT * FROM ${relations.cellsRelation}`
        : undefined,
    [relations?.cellsRelation],
  );
  const rowTotalsQuery = useMemo(
    () =>
      relations?.rowTotalsRelation
        ? `SELECT * FROM ${relations.rowTotalsRelation}`
        : undefined,
    [relations?.rowTotalsRelation],
  );
  const colTotalsQuery = useMemo(
    () =>
      relations?.colTotalsRelation
        ? `SELECT * FROM ${relations.colTotalsRelation}`
        : undefined,
    [relations?.colTotalsRelation],
  );
  const grandTotalQuery = useMemo(
    () =>
      relations?.grandTotalRelation
        ? `SELECT * FROM ${relations.grandTotalRelation}`
        : undefined,
    [relations?.grandTotalRelation],
  );

  const cellsResult = useSql<PivotRow>({
    query: cellsQuery || '',
    enabled: Boolean(cellsQuery),
  });
  const rowTotalsResult = useSql<PivotRow>({
    query: rowTotalsQuery || '',
    enabled: Boolean(rowTotalsQuery),
  });
  const colTotalsResult = useSql<PivotRow>({
    query: colTotalsQuery || '',
    enabled: Boolean(colTotalsQuery),
  });
  const grandTotalResult = useSql<PivotRow>({
    query: grandTotalQuery || '',
    enabled: Boolean(grandTotalQuery),
  });

  const grandTotal = useMemo(() => {
    return grandTotalResult.data?.arrowTable?.getChild('value')?.get(0) ?? null;
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
    if (!relations?.cellsRelation) {
      return '';
    }
    const colLabels = getUniqueStringColumnValues(
      cellsResult.data?.arrowTable,
      'col_label',
    );
    return buildPivotExportQuery(config, relations.cellsRelation, colLabels);
  }, [cellsResult.data?.arrowTable, config, relations?.cellsRelation]);

  if (!relations) {
    return (
      <div className="text-muted-foreground flex h-80 items-center justify-center text-sm">
        Run pivot to preview results.
      </div>
    );
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
      cellRows={cellsResult.data?.arrowTable}
      rowTotals={rowTotalsResult.data?.arrowTable}
      colTotals={colTotalsResult.data?.arrowTable}
      grandTotal={grandTotal}
      heatmapMode={heatmapMode}
    />
  );
};
