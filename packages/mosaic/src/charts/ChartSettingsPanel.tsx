import {type DataTable} from '@sqlrooms/db';
import {FC} from 'react';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import {Input} from '@sqlrooms/ui';

export type ChartSettingsPanelProps = {
  dataTable: DataTable | undefined;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  onTableChange: (table: DataTable) => void;
  /** Optional title value and change handler */
  title?: string;
  onTitleChange?: (title: string) => void;
};

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
  dataTable,
  config,
  onConfigChange,
  onTableChange,
  title,
  onTitleChange,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart Settings</h3>
      </div>

      {title !== undefined && onTitleChange ? (
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Chart title"
            className="text-xs"
          />
        </Field>
      ) : null}

      <Field label="Dataset" required>
        <DataTableSelector
          onChange={onTableChange}
          tables={tables}
          value={dataTable}
          className="w-full"
        />
      </Field>

      <MosaicChartSettingsPanel
        dataTable={dataTable}
        config={config}
        onChange={onConfigChange}
      />
    </div>
  );
};
