import {type FC, useCallback, useState} from 'react';
import {MosaicChartSettings} from './chart-settings/MosaicChartSettings';
import {type ChartConfig} from './chart-types/chart-config';
import {type DataTable} from '@sqlrooms/db';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';
import {MosaicChartSpecViewerPanel} from './chart-settings/MosaicChartSpecViewerPanel';

/**
 * Props for the Mosaic chart settings panel.
 */
export type MosaicChartSettingsPanelProps = {
  /** Data table that supplies fields available to the chart configuration. */
  dataTable?: DataTable;
  /** Current chart configuration shown in the settings controls. */
  config: ChartConfig;
  /** Called when the chart configuration changes. */
  onChange: (config: ChartConfig) => void;
};

/**
 * Renders chart configuration controls and the generated chart spec viewer.
 */
export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  dataTable,
  config,
  onChange,
}) => {
  const columns = dataTable?.columns || [];
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');
  const renderContext = useMosaicChartRenderContext(dataTable, config);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  if (renderContext.type === 'spec' && viewMode === 'spec') {
    return (
      <MosaicChartSpecViewerPanel
        spec={renderContext.spec}
        onBack={handleBackToSettings}
      />
    );
  }

  const showViewSpec = renderContext.type === 'spec';

  return (
    <MosaicChartSettings.Root
      config={config}
      columns={columns}
      onChange={onChange}
    >
      {showViewSpec && (
        <div className="mb-2 flex justify-end">
          <MosaicChartSettings.ViewSpecButton onClick={handleViewSpec} />
        </div>
      )}
      <MosaicChartSettings.TypeSelector />
      <MosaicChartSettings.Fields />
    </MosaicChartSettings.Root>
  );
};
