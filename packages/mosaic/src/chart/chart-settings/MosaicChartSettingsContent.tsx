import {FC, useCallback, useState} from 'react';
import {MosaicChartSpecViewerPanel} from './MosaicChartSpecViewerPanel';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {Spec} from '@uwdata/mosaic-spec';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';

interface MosaicChartSettingsContentProps {
  dashboardId: string;
  tableName: string;
  spec?: Spec;
  panel: ChartPanelConfig;
  onClose?: () => void;
}

export const MosaicChartSettingsContent: FC<
  MosaicChartSettingsContentProps
> = ({dashboardId, panel, tableName, spec, onClose}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');

  const handleViewSpec = useCallback(() => {
    setViewMode('spec');
  }, []);

  const handleBackToSettings = useCallback(() => {
    setViewMode('settings');
  }, []);

  if (spec && viewMode === 'spec') {
    return (
      <MosaicChartSpecViewerPanel spec={spec} onBack={handleBackToSettings} />
    );
  }

  return (
    <MosaicChartSettingsPanel
      dashboardId={dashboardId}
      panel={panel}
      tableName={tableName}
      spec={spec}
      onClose={onClose}
      onViewSpec={handleViewSpec}
    />
  );
};
