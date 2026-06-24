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
};

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  dataTable,
  config,
  onChange,
}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');

  const renderContext = useMosaicChartRenderContext(dataTable, config);

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
      <MosaicChartSettings.TypeSelector />
      <MosaicChartSettings.Fields />
    </MosaicChartSettings.Root>
  );
};
