import {type DataTable} from '@sqlrooms/db';
import {FC, useCallback, useState} from 'react';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTableSelector} from '../components/DataTableSelector';
import {useTablesWithColumns} from '../hooks/useTablesWithColumns';
import {Field} from '../components/Field';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import {ScrollArea, SettingsPanelHeader} from '@sqlrooms/ui';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';
import {MosaicChartSettings} from './chart-settings/MosaicChartSettings';
import {MosaicChartSpecViewerPanel} from './chart-settings/MosaicChartSpecViewerPanel';

/**
 * Props for the ChartSettingsPanel component.
 *
 * @property dataTable - The data table used by the chart
 * @property config - Current chart configuration
 * @property onConfigChange - Callback when chart configuration changes
 * @property onTableChange - Callback when the selected data table changes
 * @property title - Optional title/caption for the chart
 * @property onTitleChange - Callback when the chart title changes
 * @property readOnly - Whether settings should be non-mutating
 * @property onClose - Optional callback to close the host settings panel
 */
export type ChartSettingsPanelProps = {
  dataTable: DataTable | undefined;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  onTableChange: (table: DataTable) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
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
  readOnly,
  onClose,
}) => {
  const tables = useTablesWithColumns();
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');
  const renderContext = useMosaicChartRenderContext(dataTable, config);

  const hasSpec = renderContext.type === 'spec';
  const showSpec = hasSpec && viewMode === 'spec';

  const handleToggleSpec = useCallback(() => {
    setViewMode((currentViewMode) =>
      currentViewMode === 'spec' ? 'settings' : 'spec',
    );
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsPanelHeader
        className="shrink-0 p-2"
        actions={
          hasSpec ? (
            <MosaicChartSettings.ViewSpecButton
              label={showSpec ? 'Show settings' : 'View spec'}
              selected={showSpec}
              onClick={handleToggleSpec}
            />
          ) : undefined
        }
        onClose={onClose}
        closeLabel="Close chart settings"
      />

      {showSpec ? (
        <div className="min-h-0 flex-1">
          <MosaicChartSpecViewerPanel
            spec={renderContext.spec}
            onBack={() => setViewMode('settings')}
            showHeader={false}
          />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div className="flex flex-col gap-2 p-2 pt-0">
            <Field label="Title">
              <input
                value={title ?? ''}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder="Enter title"
                disabled={readOnly}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-3 py-2 text-xs font-medium shadow-sm outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>

            <Field label="Dataset" required>
              <DataTableSelector
                onChange={onTableChange}
                tables={tables}
                value={dataTable}
                className="w-full"
                disabled={readOnly}
              />
            </Field>

            <MosaicChartSettingsPanel
              dataTable={dataTable}
              config={config}
              onChange={onConfigChange}
              readOnly={readOnly}
              showViewSpecButton={false}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
