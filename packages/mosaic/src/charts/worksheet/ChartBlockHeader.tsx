import type {DataTable} from '@sqlrooms/db';
import type {ChartConfig} from '../chart-types/chart-config';
import {Button, cn, EditableText} from '@sqlrooms/ui';
import {Settings2Icon} from 'lucide-react';
import {FC} from 'react';
import {DataTableSelector} from '../../components/DataTableSelector';

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
      <EditableText
        className="min-w-0 flex-1 text-sm font-medium"
        value={caption ?? ''}
        placeholder={tableName || 'Chart caption'}
        isReadOnly={readOnly}
        onChange={(value) => onCaptionChange?.(value || undefined)}
      />

      <DataTableSelector
        className="w-48"
        disabled={readOnly || !onTableChange}
        onChange={onTableChange}
        tables={tables}
        value={selectedTable}
      />

      <Button
        type="button"
        size="icon"
        variant={chartConfig.settingsOpen ? 'secondary' : 'ghost'}
        className={cn('h-7 w-7', readOnly && 'hidden')}
        aria-label="Chart settings"
        title="Chart settings"
        aria-pressed={chartConfig.settingsOpen}
        onClick={() => onSettingsOpenChange(!chartConfig.settingsOpen)}
      >
        <Settings2Icon className="h-4 w-4" />
      </Button>
    </div>
  );
};
