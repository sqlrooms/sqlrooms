import type {BlockDocumentChartRendererProps} from '@sqlrooms/documents';
import {
  MosaicDashboardChart,
  useParseChartConfig,
  useTablesWithColumns,
  type ChartConfig,
} from '@sqlrooms/mosaic';
import {Button, cn} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {FC, useCallback} from 'react';

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

export const WorksheetChartRenderer: FC<BlockDocumentChartRendererProps> = ({
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
  const fallbackTable = tables[0];
  // const fallbackField = fallbackTable?.columns?.[0]?.name;
  const effectiveTableName = tableName || fallbackTable?.table.table || '';

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
      <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
        {readOnly ? (
          <div className="min-w-0 flex-1 truncate text-sm font-medium">
            {caption || effectiveTableName || 'Chart'}
          </div>
        ) : (
          <input
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            value={caption ?? ''}
            placeholder={effectiveTableName || 'Chart caption'}
            aria-label="Chart caption"
            onChange={(event) =>
              onCaptionChange?.(event.target.value || undefined)
            }
          />
        )}
        <Button
          type="button"
          size="icon"
          variant={chartConfig.settingsOpen ? 'secondary' : 'ghost'}
          className={cn('h-7 w-7', readOnly && 'hidden')}
          aria-label="Chart settings"
          title="Chart settings"
          aria-pressed={chartConfig.settingsOpen}
          onClick={() => handleSettingsOpenChange(!chartConfig.settingsOpen)}
        >
          <Settings2Icon className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <MosaicDashboardChart
          tableName={effectiveTableName}
          selectionName={selectionName}
          config={chartConfig}
          runtimeKey={runtimeKey}
          onConfigChange={handleConfigChange}
        />
      </div>
    </div>
  );
};
