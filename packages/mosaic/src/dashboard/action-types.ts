/**
 * Dashboard action types - separated to avoid circular dependencies with chart types.
 */

import type {ComponentType} from 'react';
import type {DataTable} from '@sqlrooms/db';
import type {ChartTypeDefinition} from '../chart-types/base-types';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from './dashboard-types';

export type MosaicDashboardAddPanelActionContext = {
  dashboardId: string;
  dashboard: MosaicDashboardEntry | undefined;
  selectedTable: DataTable | undefined;
  tables: DataTable[];
  chartTypes: ChartTypeDefinition[] | undefined;
};

export type MosaicDashboardAddPanelAction = {
  type: string;
  label: string;
  icon?: ComponentType<{className?: string}>;
  isEnabled?: (context: MosaicDashboardAddPanelActionContext) => boolean;
  createPanel: (
    context: MosaicDashboardAddPanelActionContext,
  ) => MosaicDashboardPanelConfig | undefined;
};

export type OnStartDashboard = (prompt: string) => void | Promise<void>;
