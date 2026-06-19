import type {PanelPatch} from '../../charts/chart-types';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../../dashboard/dashboard-types';
import type {ChartRuntimeIssue} from '../../chart-runtime';
import type {BaseAgentToolOptions} from '../types';
import {DatabaseAiAdapter} from '../database-types';
import {Tool} from 'ai';

/**
 * Dashboard adapter with full dashboard panel management capabilities.
 * Extends BaseAiAdapter with dashboard-specific operations.
 */
export type DashboardAiAdapter = {
  getDashboard: () => MosaicDashboardEntry | undefined;
  getPanelIssue?: (panelId: string) => ChartRuntimeIssue | undefined;
  setSelectedTable: (tableName: string) => void;
  getPanel(panelId: string): MosaicDashboardPanelConfig | undefined;
  updatePanel(panelId: string, patch: Partial<PanelPatch>): void;
  removePanel(panelId: string): void;
  addPanel(panel: MosaicDashboardPanelConfig): string;
};

export type DashboardAgentResult = {
  success: boolean;
  finalOutput: string;
  dashboardId: string;
  error?: string;
  metadata?: DashboardAgentResultMetadata;
};

export type DashboardAgentResultMetadata = {
  tableName?: string;
  panelsCreated: number;
  stepsExecuted: number;
  queriesRun: number;
};

export type ExtraDashboardAiToolsParams = {
  dashboardAdapter: DashboardAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

export type ExtraDashboardAiToolsFactory = (
  params: ExtraDashboardAiToolsParams,
) => Record<string, Tool>;

export type CreateDashboardAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    databaseAdapter: DatabaseAiAdapter;
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: ExtraDashboardAiToolsFactory;
  };
