import {type FC} from 'react';
import {ChartTypeDefinition} from '../chart-types/base-types';
import {UseGenerateSpecResult} from './useGenerateSpec';
import {MosaicReadyConnection} from '../MosaicSlice';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {getMosaicDashboardPanelId} from '../dashboard/MosaicDashboardSlice';
import {MosaicChartView} from './MosaicChartView';

export type MosaicDashboardChartContentProps = {
  chartTypeDefinition: ChartTypeDefinition;
  tableName: string;
  connection: MosaicReadyConnection;
  spec: UseGenerateSpecResult;
  selectionName: string;
  panel: ChartPanelConfig;
  dashboardId: string;
};

export const MosaicDashboardChartContent: FC<
  MosaicDashboardChartContentProps
> = ({
  selectionName,
  panel,
  dashboardId,
  chartTypeDefinition,
  tableName,
  connection,
  spec,
}) => {
  void connection;
  void spec;
  const runtimeKey = getMosaicDashboardPanelId(dashboardId, panel.id);
  return (
    <MosaicChartView
      tableName={tableName}
      config={panel.config}
      selectionName={selectionName}
      retentionKey={runtimeKey}
      runtimeIssueKey={runtimeKey}
      chartTypeDefinition={chartTypeDefinition}
    />
  );
};
