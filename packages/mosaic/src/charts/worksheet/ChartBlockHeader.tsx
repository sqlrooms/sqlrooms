import type {DataTable} from '@sqlrooms/db';
import type {ChartConfig} from '../chart-types/chart-config';
import {cn} from '@sqlrooms/ui';
import {FC} from 'react';
import {DataTableSelector} from '../../components/DataTableSelector';
import {MosaicChartSettingsButton} from '../MosaicChartSettingsButton';
import {BlockCaptionEditor} from '../../components/BlockCaptionEditor';

export type ChartBlockHeaderProps = {
  caption?: string;
  chartConfig: ChartConfig;
  onCaptionChange?: (caption: string | undefined) => void;
  onSettingsOpenChange: (open: boolean) => void;
  onTableChange?: (table: DataTable) => void;
  readOnly?: boolean;
  tables: DataTable[];
  selectedTable: DataTable;
};

export const ChartBlockHeader: FC<ChartBlockHeaderProps> = ({
  caption,
  chartConfig,
  onCaptionChange,
  onSettingsOpenChange,
  onTableChange,
  readOnly,
  selectedTable,
  tables,
}) => {
  const tableName = selectedTable.table.table;

  return (
    <div className="border-border flex min-h-10 items-center gap-2 border-b px-3 py-2">
      <BlockCaptionEditor
        value={caption ?? ''}
        placeholder={tableName || 'Chart caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />

      <DataTableSelector
        disabled={readOnly || !onTableChange}
        onChange={onTableChange}
        tables={tables}
        value={selectedTable}
      />

      <MosaicChartSettingsButton
        className={cn('h-8 w-8', {hidden: readOnly})}
        isSettingsOpen={chartConfig.settingsOpen}
        onToggleSettings={() => onSettingsOpenChange(!chartConfig.settingsOpen)}
      />
    </div>
  );
};
