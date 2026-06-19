import {type FC, useCallback} from 'react';
import {ScrollArea, ScrollBar} from '@sqlrooms/ui';
import {MosaicDashboardPanelLayout} from '../dashboard/panel/MosaicDashboardPanelLayout';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import type {ChartConfig} from './chart-types/chart-config';
import {MosaicChartView} from './MosaicChartView';
import {DataTable} from '@sqlrooms/db';

export type MosaicChartProps = {
  dataTable?: DataTable;
  selectionName?: string;
  config: ChartConfig;
  runtimeKey: string;
  onConfigChange?: (config: ChartConfig) => void;
  dashboardId?: string;
  panelId?: string;
};

export const MosaicChart: FC<MosaicChartProps> = ({
  dataTable,
  selectionName,
  config,
  runtimeKey,
  onConfigChange,
  dashboardId,
  panelId,
}) => {
  const handleOpenChange = useCallback(
    (isOpen: boolean) => onConfigChange?.({...config, settingsOpen: isOpen}),
    [config, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (newConfig: ChartConfig) => onConfigChange?.(newConfig),
    [onConfigChange],
  );

  const settingsContent = (
    <MosaicChartSettingsPanel
      dataTable={dataTable}
      config={config}
      onChange={handleConfigChange}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:h-full">
      <div className="h-full p-2">
        <MosaicChartView
          dataTable={dataTable}
          config={config}
          selectionName={selectionName}
          retentionKey={runtimeKey}
          runtimeIssueKey={runtimeKey}
          dashboardId={dashboardId}
          panelId={panelId}
        />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={config.settingsOpen}
        onIsOpenChange={handleOpenChange}
        settings={settingsContent}
        content={chartContent}
      />
    </div>
  );
};
