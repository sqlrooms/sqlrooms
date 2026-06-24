import {useDataTable, type DataTable} from '@sqlrooms/db';
import {ChartConfig, ChartSettingsPanel} from '@sqlrooms/mosaic';
import type {BlockSettingsComponentProps} from '@sqlrooms/documents';
import {useChartBlock} from './useChartBlock';
import {useRoomStore} from '../../store';
import {FC} from 'react';

export const BlockChartSettings: FC<BlockSettingsComponentProps> = ({
  blockId,
  dashboardId,
}) => {
  // For standalone chart blocks (in worksheets)
  const chartBlock = useChartBlock(dashboardId, blockId);
  const updateBlock = useRoomStore((state) => state.blockDocuments.updateBlock);

  if (!chartBlock) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Chart block not found</p>
      </div>
    );
  }

  const tableName = chartBlock.tableName;
  const config = (chartBlock.config || {}) as ChartConfig;

  // Get the data table for the chart
  const dataTable = useDataTable(tableName);

  const handleConfigChange = (newConfig: ChartConfig) => {
    updateBlock(dashboardId!, blockId, {
      ...chartBlock,
      config: newConfig,
    });
  };

  const handleTableChange = (table: DataTable) => {
    updateBlock(dashboardId!, blockId, {
      ...chartBlock,
      tableName: table.table.table,
    });
  };

  return (
    <ChartSettingsPanel
      dataTable={dataTable}
      config={config}
      onConfigChange={handleConfigChange}
      onTableChange={handleTableChange}
    />
  );
};
