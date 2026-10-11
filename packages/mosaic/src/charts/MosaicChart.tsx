import {type FC} from 'react';
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
  dashboardId,
  panelId,
}) => {
  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden p-2">
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
  );
};
