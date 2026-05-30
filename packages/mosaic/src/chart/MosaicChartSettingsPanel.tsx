import {type FC, useCallback, useState} from 'react';
import {type Spec} from '@uwdata/mosaic-spec';
import {ChartSettings} from './chart-settings/ChartSettings';
import {ChartSpecViewerPanel} from './chart-settings/ChartSpecViewerPanel';
import {useTableColumns} from './chart-settings/useTableColumns';
import {type ChartConfig} from '../chart-types/chart-config';

export type MosaicChartSettingsPanelProps = {
  tableName: string;
  config: ChartConfig;
  spec?: Spec;
  onChange: (config: ChartConfig) => void;
  onClose?: () => void;
};

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  tableName,
  config,
  spec,
  onChange,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');
  const columns = useTableColumns(tableName);

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  if (spec && viewMode === 'spec') {
    return <ChartSpecViewerPanel spec={spec} onBack={handleBackToSettings} />;
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
          {spec && <ChartSettings.ViewSpecButton onClick={handleViewSpec} />}
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
