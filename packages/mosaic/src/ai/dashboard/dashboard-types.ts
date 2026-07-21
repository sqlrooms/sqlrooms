import type {PanelPatch} from '../../charts/chart-types/base-types';
import type {MosaicDashboardPanelConfig} from '../../dashboard/dashboard-types';
import type {ChartRuntimeIssue} from '../../chart-runtime';
import type {BaseAgentToolOptions} from '../types';
import {DatabaseAiAdapter} from '../database-types';
import {Tool} from 'ai';
import {AgentResultMetadata} from '../tool-types';

/**
 * Dashboard adapter with full dashboard panel management capabilities.
 * Extends BaseAiAdapter with dashboard-specific operations.
 */
export type DashboardAiAdapter = {
  getPanelIssue?: (panelId: string) => ChartRuntimeIssue | undefined;
  getSelectedTable?: () => string | undefined;
  getPanels?: () => MosaicDashboardPanelConfig[];
  setSelectedTable: (tableName: string) => void | Promise<void>;
  getPanel(panelId: string): MosaicDashboardPanelConfig | undefined;
  updatePanel(
    panelId: string,
    patch: Partial<PanelPatch>,
  ): void | Promise<void>;
  removePanel(panelId: string): void | Promise<void>;
  addPanel(panel: MosaicDashboardPanelConfig): string | Promise<string>;
};

/**
 * Result returned by the dashboard agent after completing a task.
 * Contains execution status, final output, and optional metadata about the run.
 */
export type DashboardAgentResult = {
  success: boolean;
  finalOutput: string;
  dashboardId: string;
  error?: string;
  metadata?: AgentResultMetadata;
};

/**
 * Parameters passed to extra dashboard AI tools factory.
 * Provides adapters for dashboard and database operations.
 */
export type ExtraDashboardAiToolsParams = {
  dashboardAdapter: DashboardAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

/**
 * Factory function for creating additional dashboard AI tools.
 * Allows hosts to register custom tools that extend the dashboard agent's capabilities.
 */
export type ExtraDashboardAiToolsFactory = (
  params: ExtraDashboardAiToolsParams,
) => Record<string, Tool>;

/**
 * Authorizes mutation of a specific dashboard using the latest store state.
 *
 * The dashboard target is fixed by the caller. Throw (or reject) to deny the
 * mutation; the dashboard agent and adapter do not select an alternative
 * dashboard. Callers may surface the failure or explicitly establish a new
 * valid target in a separate operation.
 */
export type AuthorizeDashboard<TState> = (params: {
  dashboardId: string;
  state: TState;
}) => void | Promise<void>;

/**
 * Options for creating a dashboard agent tool.
 * Extends base agent options with dashboard-specific database adapter and optional extra tools.
 */
export type CreateDashboardAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    databaseAdapter: DatabaseAiAdapter;
    /**
     * Optional host authorization for a resolved dashboard target.
     *
     * Hosts can use this to enforce product-specific ownership constraints,
     * such as requiring the dashboard to belong to a captured block document.
     * The callback runs once when the dashboard agent starts and again with
     * fresh state immediately before every adapter mutation. Throwing or
     * rejecting blocks the operation; it does not make the agent retarget a
     * different dashboard.
     */
    authorizeDashboard?: AuthorizeDashboard<TState>;
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: ExtraDashboardAiToolsFactory;
  };
