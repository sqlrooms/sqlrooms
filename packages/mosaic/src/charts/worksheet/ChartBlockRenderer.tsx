import type {DataTable} from '@sqlrooms/db';
import type {BlockDocumentChartRendererProps} from '@sqlrooms/documents';
import {FC, useCallback} from 'react';
import type {ChartConfig} from '../chart-types/chart-config';
import {MosaicChart} from '../MosaicChart';
import {useParseChartConfig} from '../useParseChartConfig';
import {useDataTable} from '../../hooks/useDataTable';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {ChartBlockHeader} from './ChartBlockHeader';
import {ChartSelectorEmptyState} from './ChartSelectorEmptyState';

function getBlockDocumentChartSelectionName({
  documentId,
  blockId,
  selectionGroupId,
}: Pick<
  BlockDocumentChartRendererProps,
  'documentId' | 'blockId' | 'selectionGroupId'
>) {
  return selectionGroupId
    ? `worksheet:${documentId}:chart-group:${selectionGroupId}:brush`
    : `worksheet:${documentId}:chart-block:${blockId}:brush`;
}

function getBlockDocumentChartRuntimeKey({
  documentId,
  blockId,
}: Pick<BlockDocumentChartRendererProps, 'documentId' | 'blockId'>) {
  return `worksheet:${documentId}:chart-block:${blockId}`;
}

export const ChartBlockRenderer: FC<BlockDocumentChartRendererProps> = ({
  documentId,
  blockId,
  tableName,
  config,
  selectionGroupId,
  caption,
  readOnly,
  onTableNameChange,
  onConfigChange,
  onCaptionChange,
}) => {
  const tables = useTablesWithColumns();
  const selectedTable = useDataTable(tableName);

  const parseChartConfigResult = useParseChartConfig(config);

  const selectionName = getBlockDocumentChartSelectionName({
    documentId,
    blockId,
    selectionGroupId,
  });

  const runtimeKey = getBlockDocumentChartRuntimeKey({documentId, blockId});

  const handleSettingsOpenChange = useCallback(
    (settingsOpen: boolean) => {
      if (parseChartConfigResult.success) {
        onConfigChange?.({...parseChartConfigResult.config, settingsOpen});
      }
    },
    [parseChartConfigResult, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (nextConfig: ChartConfig) => {
      onConfigChange?.(nextConfig);
    },
    [onConfigChange],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      onTableNameChange?.(table.table.toString());
    },
    [onTableNameChange],
  );

  if (!selectedTable) {
    return (
      <ChartSelectorEmptyState
        disabled={readOnly || !onTableNameChange}
        onChange={handleTableChange}
        tables={tables}
      />
    );
  }

  if (!parseChartConfigResult.success) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Invalid chart configuration: {parseChartConfigResult.error}
      </div>
    );
  }

  const chartConfig = parseChartConfigResult.config;

  return (
    <div className="flex h-105 min-h-80 flex-col">
      <ChartBlockHeader
        caption={caption}
        chartConfig={chartConfig}
        selectedTable={selectedTable}
        onCaptionChange={onCaptionChange}
        onSettingsOpenChange={handleSettingsOpenChange}
        onTableChange={handleTableChange}
        readOnly={readOnly}
        tables={tables}
      />
      <div className="min-h-0 flex-1">
        <MosaicChart
          dataTable={selectedTable}
          selectionName={selectionName}
          config={chartConfig}
          runtimeKey={runtimeKey}
          onConfigChange={handleConfigChange}
        />
      </div>
    </div>
  );
};
