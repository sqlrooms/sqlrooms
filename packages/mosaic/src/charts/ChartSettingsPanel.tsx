import {type DataTable} from '@sqlrooms/db';
import {FC} from 'react';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';

/**
 * Props for the ChartSettingsPanel component.
 *
 * @property dataTable - The data table used by the chart
 * @property config - Current chart configuration
 * @property onConfigChange - Callback when chart configuration changes
 * @property onTableChange - Callback when the selected data table changes
 * @property title - Optional title/caption for the chart
 * @property onTitleChange - Callback when the chart title changes
 * @property onClose - Optional callback to close the host settings panel
 */
export type ChartSettingsPanelProps = {
  dataTable: DataTable | undefined;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  onTableChange: (table: DataTable) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  onClose?: () => void;
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
  onClose,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex min-h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart Settings</h3>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Close chart settings"
            onClick={onClose}
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      <Field label="Title">
        <input
          value={title ?? ''}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Enter title"
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-6 w-full rounded-sm border bg-transparent px-2 py-0 text-xs font-medium shadow-sm outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
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
