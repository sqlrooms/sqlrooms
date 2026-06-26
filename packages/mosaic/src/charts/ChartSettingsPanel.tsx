import {type DataTable} from '@sqlrooms/db';
import {FC, useCallback, useState} from 'react';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import {Input} from '@sqlrooms/ui';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';
import {MosaicChartSpecViewerPanel} from './chart-settings/MosaicChartSpecViewerPanel';
import {MosaicChartSettings} from './chart-settings/MosaicChartSettings';

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
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');
  const renderContext = useMosaicChartRenderContext(dataTable, config);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  // Show spec viewer if it's a spec-backed chart and user clicked "View Spec"
  if (renderContext.type === 'spec' && viewMode === 'spec') {
    return (
      <div className="flex h-full flex-col">
        <MosaicChartSpecViewerPanel
          spec={renderContext.spec}
          onBack={handleBackToSettings}
        />
      </div>
    );
  }

  const showViewSpec = renderContext.type === 'spec';

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart Settings</h3>
        {showViewSpec && (
          <MosaicChartSettings.ViewSpecButton onClick={handleViewSpec} />
        )}
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
