import {type FC, useCallback, useState} from 'react';
import {MosaicChartSettings} from './chart-settings/MosaicChartSettings';
import {MosaicChartSpecViewerPanel} from './chart-settings/MosaicChartSpecViewerPanel';
import {type ChartConfig} from './chart-types/chart-config';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';
import {DataTable} from '@sqlrooms/db';

export type MosaicChartSettingsPanelProps = {
  dataTable?: DataTable;
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onClose?: () => void;
};

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  dataTable,
  config,
  onChange,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');

  const renderContext = useMosaicChartRenderContext(dataTable, config);

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  if (renderContext.type === 'spec' && viewMode === 'spec') {
    return (
      <MosaicChartSpecViewerPanel
        spec={renderContext.spec}
        onBack={handleBackToSettings}
      />
    );
  }

  const columns = dataTable?.columns || [];

  return (
    <MosaicChartSettings.Root
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <MosaicChartSettings.Header>
        <div className="flex items-center">Chart settings</div>
        <div className="flex items-center gap-1">
          {renderContext.type === 'spec' && (
            <MosaicChartSettings.ViewSpecButton onClick={handleViewSpec} />
          )}
          {onClose && <MosaicChartSettings.CloseButton onClick={onClose} />}
        </div>
      </MosaicChartSettings.Header>
      <MosaicChartSettings.Content>
        <MosaicChartSettings.TypeSelector />
        <MosaicChartSettings.Fields />
      </MosaicChartSettings.Content>
    </MosaicChartSettings.Root>
  );
};
