import {FC, useCallback, useState} from 'react';
import {ChartSpecViewerPanel} from './ChartSpecViewerPanel';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {Spec} from '@uwdata/mosaic-spec';
import {ChartSettingsPanel} from './ChartSettingsPanel';

interface ChartSettingsContentProps {
  dashboardId: string;
  tableName: string;
  spec?: Spec;
  panel: ChartPanelConfig;
  onClose?: () => void;
}

export const ChartSettingsContent: FC<ChartSettingsContentProps> = ({
  dashboardId,
  panel,
  tableName,
  spec,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'settings' | 'spec'>('settings');

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
    <ChartSettingsPanel
      dashboardId={dashboardId}
      panel={panel}
      tableName={tableName}
      spec={spec}
      onClose={onClose}
      onViewSpec={handleViewSpec}
    />
  );
};
