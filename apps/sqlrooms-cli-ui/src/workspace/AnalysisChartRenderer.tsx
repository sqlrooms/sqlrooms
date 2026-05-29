import type {BlocksDocumentChartRendererProps} from '@sqlrooms/documents';
import {
  MosaicChartSettingsPanel,
  MosaicChartView,
  MosaicDashboardPanelLayout,
  useTablesWithColumns,
  type ChartConfig,
} from '@sqlrooms/mosaic';
import {Button, cn} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {parseAnalysisChartConfig} from './analysisChartConfig';

function getBlocksDocumentChartSelectionName({
  documentId,
  blockId,
  selectionGroupId,
}: Pick<
  BlocksDocumentChartRendererProps,
  'documentId' | 'blockId' | 'selectionGroupId'
>) {
  return selectionGroupId
    ? `analysis:${documentId}:chart-group:${selectionGroupId}:brush`
    : `analysis:${documentId}:chart-block:${blockId}:brush`;
}

function getBlocksDocumentChartRuntimeKey({
  documentId,
  blockId,
}: Pick<BlocksDocumentChartRendererProps, 'documentId' | 'blockId'>) {
  return `analysis:${documentId}:chart-block:${blockId}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

export const AnalysisChartRenderer = ({
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
}: BlocksDocumentChartRendererProps) => {
  const onTableNameChangeRef = useRef(onTableNameChange);
  const onConfigChangeRef = useRef(onConfigChange);

  useEffect(() => {
    onTableNameChangeRef.current = onTableNameChange;
  }, [onTableNameChange]);

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  const tables = useTablesWithColumns();
  const fallbackTable = tables[0];
  const fallbackField = fallbackTable?.columns?.[0]?.name;
  const effectiveTableName = tableName || fallbackTable?.table.table || '';
  const defaultConfig = useMemo<ChartConfig>(() => {
    return {
      chartType: 'count-plot',
      settings: fallbackField ? {field: fallbackField} : {},
      settingsOpen: true,
    };
  }, [fallbackField]);
  const parsedConfig = useMemo(
    () => parseAnalysisChartConfig(config, defaultConfig),
    [config, defaultConfig],
  );
  const configKey = stableStringify(config);
  const chartConfig = parsedConfig.success ? parsedConfig.config : undefined;
  const selectionName = getBlocksDocumentChartSelectionName({
    documentId,
    blockId,
    selectionGroupId,
  });
  const runtimeKey = getBlocksDocumentChartRuntimeKey({documentId, blockId});

  const handleSettingsOpenChange = useCallback(
    (settingsOpen: boolean) => {
      if (!chartConfig) return;
      onConfigChange?.({...chartConfig, settingsOpen});
    },
    [chartConfig, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (nextConfig: ChartConfig) => {
      onConfigChange?.(nextConfig);
    },
    [onConfigChange],
  );

  useEffect(() => {
    if (
      parsedConfig.success &&
      parsedConfig.normalized &&
      configKey !== stableStringify(parsedConfig.config)
    ) {
      onConfigChangeRef.current?.(parsedConfig.config);
    }
  }, [configKey, parsedConfig]);

  useEffect(() => {
    if (!tableName && effectiveTableName) {
      onTableNameChangeRef.current?.(effectiveTableName);
    }
  }, [effectiveTableName, tableName]);

  if (!chartConfig) {
    return (
      <div className="p-4">
        <div className="text-sm font-medium">Invalid chart configuration</div>
        <div className="text-muted-foreground mt-1 text-sm">
          This analysis chart block could not be parsed as a Mosaic ChartConfig.
        </div>
        {!parsedConfig.success ? (
          <div className="text-muted-foreground mt-2 text-xs">
            {parsedConfig.error}
          </div>
        ) : null}
      </div>
    );
  }

  const settings = (
    <MosaicChartSettingsPanel
      tableName={effectiveTableName}
      config={chartConfig}
      onChange={handleConfigChange}
      onClose={() => handleSettingsOpenChange(false)}
    />
  );
  const content = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        tableName={effectiveTableName}
        config={chartConfig}
        selectionName={selectionName}
        retentionKey={runtimeKey}
        runtimeIssueKey={runtimeKey}
        className="h-full"
      />
    </div>
  );

  return (
    <div className="flex h-[420px] min-h-[320px] flex-col">
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
        <MosaicDashboardPanelLayout
          isOpen={Boolean(chartConfig.settingsOpen)}
          onIsOpenChange={handleSettingsOpenChange}
          settings={settings}
          content={content}
        />
      </div>
    </div>
  );
};
