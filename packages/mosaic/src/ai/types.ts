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

// ============================================================================
// Common types (used by both dashboard and worksheet agents)
// ============================================================================

export type AiStore<TState> = {
  getState: () => TState;
};

export type AgentToolCall = {
  toolName: string;
};

export type AgentRunResult = {
  finalOutput?: string;
  agentToolCalls?: AgentToolCall[];
};

/**
 * Minimal adapter interface for chart configuration tools.
 * Chart tools only need access to tables for validation.
 *
 * This is a state-less interface - implementations bind state internally.
 */
export type ChartAiAdapter = {
  /** Get all available tables */
  getTables: () => DataTable[];

  /** Find table by name, throws if not found */
  findTableByName: (tableName: string) => DataTable;
};

/**
 * Base adapter interface with common functionality needed by both
 * dashboard and worksheet agents.
 *
 * Note: This has state-full methods while ChartAiAdapter is state-less.
 */
export type BaseAiAdapter<TState> = {
  /** Get all available tables */
  getTables: (state: TState) => DataTable[];

  /** Set the current active artifact */
  setCurrentArtifact: (state: TState, artifactId: string) => void;
};

/**
 * Common options for agent creation
 */
export type BaseAgentToolOptions<TState> = {
  store: AiStore<TState>;
  getModel: (args: {state: TState}) => LanguageModel;
  createQueryTools?: (args: {store: AiStore<TState>}) => {
    query: Tool;
  };
  runSubAgent: (args: {
    agent: ToolLoopAgent<any, any, any>;
    prompt: string;
    store: AiStore<TState>;
    parentToolCallId: string;
    abortSignal?: AbortSignal;
  }) => Promise<AgentRunResult>;
  instructions?: string;
  chartTypes?: ChartTypeDefinition<any>[];
};

// ============================================================================
// Dashboard-specific types
// ============================================================================

/**
 * Dashboard adapter with full dashboard panel management capabilities.
 * Extends BaseAiAdapter with dashboard-specific operations.
 */
export type DashboardAiAdapter<TState> = BaseAiAdapter<TState> & {
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

/** @deprecated Use AiStore instead */
export type DashboardAiStore<TState> = AiStore<TState>;

export type CreateDashboardToolDepsOptions<TState> = {
  store: AiStore<TState>;
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
    adapter: DashboardAiAdapter<TState>;
    /**
     * Host-provided dashboard tools keyed by their registered tool name.
     * Register geospatial map tools under MAP_TOOL_KEY so prompts and tools
     * stay in sync.
     */
    extraTools?: (deps: DashboardToolDeps) => Record<string, Tool>;
  };

// ============================================================================
// Worksheet-specific types
// ============================================================================

/**
 * Worksheet adapter for managing worksheet artifacts (block documents).
 * Worksheets are collections of blocks, not panels.
 */
export type WorksheetAiAdapter<TState> = BaseAiAdapter<TState> & {
  /** Get current worksheet artifact ID, if any */
  getCurrentWorksheetId: (state: TState) => string | undefined;

  /** Create a new worksheet artifact and return its ID */
  createWorksheet: (state: TState, title?: string) => string;

  /** Check if artifact is a worksheet */
  isWorksheet: (state: TState, artifactId: string) => boolean;

  /** Ensure worksheet's block document exists */
  ensureWorksheet: (state: TState, worksheetId: string) => void;

  /** Get worksheet's blocks */
  getWorksheetBlocks: (state: TState, worksheetId: string) => any[] | undefined;
};

export type WorksheetAgentResult = {
  success: boolean;
  finalOutput: string;
  worksheetId: string;
  error?: string;
  metadata?: {
    tableName?: string;
    blocksCreated: number;
    stepsExecuted: number;
    queriesRun: number;
  };
};

export type CreateWorksheetAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    adapter: WorksheetAiAdapter<TState>;
    /** Command tools for executing worksheet commands (create-chart-block, etc.) */
    commandTools?: Record<string, Tool>;
  };
