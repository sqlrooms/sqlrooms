import {type FC, useCallback, useState} from 'react';
import {ChartSettings} from './chart-settings/ChartSettings';
import {ChartSpecViewerPanel} from './chart-settings/ChartSpecViewerPanel';
import {useTableColumns} from './chart-settings/useTableColumns';
import {type ChartConfig} from '../chart-types/chart-config';
import {useMosaicChartRenderContext} from './useMosaicChartRenderContext';

export type MosaicChartSettingsPanelProps = {
  tableName?: string;
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
  onClose?: () => void;
};

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  tableName,
  config,
  onChange,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');
  const columns = useTableColumns(tableName);

  const renderContext = useMosaicChartRenderContext(tableName, config);

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  if (renderContext.type === 'spec' && viewMode === 'spec') {
    return (
      <ChartSpecViewerPanel
        spec={renderContext.spec}
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
          {renderContext.type === 'spec' && (
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
