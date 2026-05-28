import type {AnalysisChartRendererProps} from '@sqlrooms/documents';
import {
  ChartConfig,
  MosaicChartSettingsPanel,
  MosaicChartView,
  MosaicDashboardPanelLayout,
} from '@sqlrooms/mosaic';
import {Button, cn} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {useCallback} from 'react';

function getAnalysisChartSelectionName({
  analysisId,
  blockId,
  selectionGroupId,
}: Pick<
  AnalysisChartRendererProps,
  'analysisId' | 'blockId' | 'selectionGroupId'
>) {
  return selectionGroupId
    ? `analysis:${analysisId}:chart-group:${selectionGroupId}:brush`
    : `analysis:${analysisId}:chart-block:${blockId}:brush`;
}

function getAnalysisChartRuntimeKey({
  analysisId,
  blockId,
}: Pick<AnalysisChartRendererProps, 'analysisId' | 'blockId'>) {
  return `analysis:${analysisId}:chart-block:${blockId}`;
}

export const AnalysisChartRenderer = ({
  analysisId,
  blockId,
  tableName,
  config,
  selectionGroupId,
  caption,
  readOnly,
  onConfigChange,
  onCaptionChange,
}: AnalysisChartRendererProps) => {
  const parsedConfig = ChartConfig.safeParse(config);
  const chartConfig = parsedConfig.success ? parsedConfig.data : undefined;
  const selectionName = getAnalysisChartSelectionName({
    analysisId,
    blockId,
    selectionGroupId,
  });
  const runtimeKey = getAnalysisChartRuntimeKey({analysisId, blockId});

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

  if (!chartConfig) {
    return (
      <div className="p-4">
        <div className="text-sm font-medium">Invalid chart configuration</div>
        <div className="text-muted-foreground mt-1 text-sm">
          This analysis chart block could not be parsed as a Mosaic ChartConfig.
        </div>
      </div>
    );
  }

  const settings = (
    <MosaicChartSettingsPanel
      tableName={tableName}
      config={chartConfig}
      onChange={handleConfigChange}
      onClose={() => handleSettingsOpenChange(false)}
    />
  );
  const content = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        tableName={tableName}
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
            {caption || tableName || 'Chart'}
          </div>
        ) : (
          <input
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            value={caption ?? ''}
            placeholder={tableName || 'Chart caption'}
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
