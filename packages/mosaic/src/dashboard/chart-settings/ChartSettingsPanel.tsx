import {FC, useCallback, useState} from 'react';
import {ChartSettings} from './ChartSettings';
import {type VgPlotChartConfig} from '../../chart-types/chart-config';
import {useTableColumns} from './useTableColumns';
import {ChartSpecViewerPanel} from './ChartSpecViewerPanel';

interface ChartSettingsPanelProps {
  tableName?: string;
  config: VgPlotChartConfig;
  onChange: (settings: VgPlotChartConfig) => void;
  onClose?: () => void;
}

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
  tableName,
  config,
  onChange,
  onClose,
}) => {
  const columns = useTableColumns(tableName);
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  const isCustomSpec = config.chartType === 'custom-spec';

  if (viewMode === 'spec' && !isCustomSpec) {
    return (
      <ChartSpecViewerPanel
        tableName={tableName}
        config={config}
        onBack={handleBackToSettings}
      />
    );
  }

  return (
    <ChartSettings.Root
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <ChartSettings.Header>
        <div className="flex items-center">Chart settings</div>
        <div className="flex items-center gap-1">
          {!isCustomSpec && (
            <ChartSettings.ViewSpecButton onClick={handleViewSpec} />
          )}
          {onClose && <ChartSettings.CloseButton onClick={onClose} />}
        </div>
      </ChartSettings.Header>
      <ChartSettings.Content>
        <ChartSettings.TypeSelector />
        <ChartSettings.Fields />
      </ChartSettings.Content>
    </ChartSettings.Root>
  );
};
