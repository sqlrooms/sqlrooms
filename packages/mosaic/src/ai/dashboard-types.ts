import type {Tool} from 'ai';
import type {
  ChartToolExecutionContext,
  PanelPatch,
  ChartTypeDefinition,
} from '../charts/chart-types';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../dashboard/dashboard-types';
import type {MosaicDashboardLayoutType} from '../dashboard/core-types';
import type {ChartRuntimeIssue} from '../chart-runtime';
import type {
  BaseMosaicAiAdapter,
  BaseAgentToolOptions,
  AiStore,
  AgentToolCall,
  AgentRunResult,
} from './types';

/**
 * Dashboard-specific AI types
 */

/**
 * Dashboard adapter with full dashboard panel management capabilities.
 * Extends BaseAiAdapter with dashboard-specific operations.
 */
export type DashboardAiAdapter = BaseMosaicAiAdapter & {
  hasRunContext?: (context?: ChartToolExecutionContext) => boolean;
  resolveContextDashboardArtifactId?: (
    context?: ChartToolExecutionContext,
  ) => string | undefined;
  makeDashboardPrimaryForRun?: (
    dashboardId: string,
    context?: ChartToolExecutionContext,
  ) => void;
  getCurrentDashboardArtifactId: () => string | undefined;
  createDashboardArtifact: (
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => string;
  ensureDashboard: (
    dashboardId: string,
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => void;
  getDashboard: (dashboardId: string) => MosaicDashboardEntry | undefined;
  getPanelIssue?: (
    dashboardId: string,
    panelId: string,
  ) => ChartRuntimeIssue | undefined;
  setSelectedTable: (dashboardId: string, tableName: string) => void;

  getPanel(panelId: string): MosaicDashboardPanelConfig | undefined;
  updatePanel(panelId: string, patch: Partial<PanelPatch>): void;
  removePanel(panelId: string): void;
  addPanel(panel: MosaicDashboardPanelConfig): string;
};

/** @deprecated Use AiStore instead */
export type DashboardAiStore<TState> = AiStore<TState>;

/** @deprecated Use AgentToolCall instead */
export type DashboardAgentToolCall = AgentToolCall;

/** @deprecated Use AgentRunResult instead */
export type DashboardAgentRunResult = AgentRunResult;

export type DashboardAgentResult = {
  success: boolean;
  finalOutput: string;
  dashboardId: string;
  error?: string;
  metadata?: {
    tableName?: string;
    panelsCreated: number;
    stepsExecuted: number;
    queriesRun: number;
  };
};

export type CreateDashboardAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    adapter: DashboardAiAdapter;
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: (adapter: DashboardAiAdapter) => Record<string, Tool>;
    chartTypes?: ChartTypeDefinition<any>[];
  };
