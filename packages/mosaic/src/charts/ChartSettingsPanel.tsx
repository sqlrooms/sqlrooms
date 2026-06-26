import {type DataTable} from '@sqlrooms/db';
import {FC} from 'react';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import {Input} from '@sqlrooms/ui';

/**
 * Props for the ChartSettingsPanel component.
 *
 * @property dataTable - The data table used by the chart
 * @property config - Current chart configuration
 * @property onConfigChange - Callback when chart configuration changes
 * @property onTableChange - Callback when the selected data table changes
 * @property title - Optional title/caption for the chart
 * @property onTitleChange - Callback when the chart title changes
 */
export type ChartSettingsPanelProps = {
  dataTable: DataTable | undefined;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  onTableChange: (table: DataTable) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
};

/**
 * Settings panel for configuring chart visualizations.
 *
 * Displays controls for:
 * - Chart title/caption
 * - Data table selection
 * - Chart-specific configuration (mark type, encodings, etc.)
 *
 * Used by both standalone chart blocks and dashboard chart panels.
 */
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

      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Enter title"
          className="text-xs"
        />
      </Field>

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
