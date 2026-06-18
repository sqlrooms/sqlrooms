import type {LanguageModel, Tool, ToolLoopAgent} from 'ai';
import type {DataTable, QualifiedTableName} from '@sqlrooms/db';
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
import {BlockDocumentBlock} from '@sqlrooms/documents';

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
export type BaseMosaicAiAdapter = {
  /** Get all available tables */
  getTables: () => DataTable[];

  /** Find table by name, returns undefined if not found */
  findTable(tableName: string | QualifiedTableName): DataTable | undefined;

  /** Set the current active artifact */
  setCurrentArtifact: (artifactId: string) => void;
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
  };

// ============================================================================
// Worksheet-specific types
// ============================================================================

/**
 * Worksheet adapter for managing worksheet artifacts (block documents).
 * Worksheets are collections of blocks, not panels.
 * Worksheet adapter manages its own state internally via the store.
 */
export type WorksheetAiAdapter = BaseMosaicAiAdapter & {
  /** Get all available tables */
  getTables(): DataTable[];

  /** Set the current active artifact */
  setCurrentArtifact(artifactId: string): void;

  /** Get current worksheet artifact ID, if any */
  getCurrentWorksheetId(): string | undefined;

  /** Create a new worksheet artifact and return its ID */
  createWorksheet(title?: string): string;

  /** Check if artifact is a worksheet */
  isWorksheet(artifactId: string): boolean;

  /** Ensure worksheet's block document exists */
  ensureWorksheet(worksheetId: string): void;

  /** Get worksheet's blocks */
  getWorksheetBlocks(worksheetId: string): any[] | undefined;

  /** Add a block to the worksheet */
  addBlock(worksheetId: string, block: BlockDocumentBlock): string;

  /** Add a dashboard block to the worksheet */
  addDashboardBlock(
    worksheetId: string,
    title: string,
    tableName: string,
  ): {dashboardId: string; blockId: string};
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
    adapter: WorksheetAiAdapter;
  };
