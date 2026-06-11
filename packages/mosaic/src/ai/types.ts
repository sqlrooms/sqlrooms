import type {LanguageModel, Tool, ToolLoopAgent} from 'ai';
import type {DataTable} from '@sqlrooms/db';
import type {
  ChartToolExecutionContext,
  DashboardToolDeps,
  PanelPatch,
  ChartTypeDefinition,
} from '../charts/chart-types';
import type {
  MosaicDashboardEntry,
  MosaicDashboardPanelConfig,
} from '../dashboard/dashboard-types';
import type {MosaicDashboardLayoutType} from '../dashboard/core-types';
import type {ChartRuntimeIssue} from '../chart-runtime';

export type DashboardAiStore<TState> = {
  getState: () => TState;
};

export type DashboardAiAdapter<TState> = {
  getTables: (state: TState) => DataTable[];
  hasRunContext?: (
    state: TState,
    context?: ChartToolExecutionContext,
  ) => boolean;
  resolveContextDashboardArtifactId?: (
    state: TState,
    context?: ChartToolExecutionContext,
  ) => string | undefined;
  makeDashboardPrimaryForRun?: (
    state: TState,
    dashboardId: string,
    context?: ChartToolExecutionContext,
  ) => void;
  getCurrentDashboardArtifactId: (state: TState) => string | undefined;
  createDashboardArtifact: (
    state: TState,
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => string;
  isDashboardArtifact: (state: TState, artifactId: string) => boolean;
  setCurrentArtifact: (state: TState, artifactId: string) => void;
  ensureDashboard: (
    state: TState,
    dashboardId: string,
    title?: string,
    layoutType?: MosaicDashboardLayoutType,
  ) => void;
  getDashboard: (
    state: TState,
    dashboardId: string,
  ) => MosaicDashboardEntry | undefined;
  getPanelIssue?: (
    state: TState,
    dashboardId: string,
    panelId: string,
  ) => ChartRuntimeIssue | undefined;
  setSelectedTable: (
    state: TState,
    dashboardId: string,
    tableName: string,
  ) => void;
  addPanel: (
    state: TState,
    dashboardId: string,
    panel: MosaicDashboardPanelConfig,
  ) => string;
  updatePanel: (
    state: TState,
    dashboardId: string,
    panelId: string,
    patch: Partial<PanelPatch>,
  ) => void;
  removePanel: (state: TState, dashboardId: string, panelId: string) => void;
};

export type CreateDashboardToolDepsOptions<TState> = {
  store: DashboardAiStore<TState>;
  adapter: DashboardAiAdapter<TState>;
};

export type CreateDashboardAiToolsOptions<TState> =
  CreateDashboardToolDepsOptions<TState> & {
    chartTypes?: ChartTypeDefinition<any>[];
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>;
  };

export type DashboardAgentToolCall = {
  toolName: string;
};

export type DashboardAgentRunResult = {
  finalOutput?: string;
  agentToolCalls?: DashboardAgentToolCall[];
};

export type DashboardAgentResult = {
  success: boolean;
  finalOutput: string;
  dashboardId: string;
  error?: string;
  metadata?: {
    tableName: string;
    panelsCreated: number;
    stepsExecuted: number;
    queriesRun: number;
  };
};

export type CreateDashboardAgentToolOptions<TState> =
  CreateDashboardToolDepsOptions<TState> & {
    getModel: (args: {state: TState}) => LanguageModel;
    createQueryTools?: (args: {store: DashboardAiStore<TState>}) => {
      query: Tool;
    };
    runSubAgent: (args: {
      agent: ToolLoopAgent<any, any, any>;
      prompt: string;
      store: DashboardAiStore<TState>;
      parentToolCallId: string;
      abortSignal?: AbortSignal;
    }) => Promise<DashboardAgentRunResult>;
    instructions?: string;
    chartTypes?: ChartTypeDefinition<any>[];
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>;
  };
