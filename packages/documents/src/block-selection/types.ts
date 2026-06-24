import type {ComponentType} from 'react';

export type SelectedBlock = {
  type: 'dashboard-panel' | 'standalone-block' | 'dashboard-block';
  id: string;
  dashboardId?: string;
  panelType?: string; // For dashboard panels
};

export type BlockSettingsComponentProps = {
  blockId: string;
  dashboardId?: string;
};

export type BlockSettingsComponent = ComponentType<BlockSettingsComponentProps>;
