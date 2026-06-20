import type {LanguageModel, Tool, ToolLoopAgent} from 'ai';
import type {DataTable} from '@sqlrooms/db';
import type {ChartTypeDefinition} from '../charts/chart-types/base-types';

/**
 * Common types used by both dashboard and worksheet agents
 */

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

export type ChartToolsOptions = {
  chartTypes?: ChartTypeDefinition<any>[];
  chartMaxDataPoints?: number;
};

/**
 * Common options for agent creation
 */
export type BaseAgentToolOptions<TState> = {
  store: AiStore<TState>;
  getModel: (args: {state: TState}) => LanguageModel;
  createDataTools?: (args: {store: AiStore<TState>}) => {
    query: Tool;
    list_tables: Tool;
    read_table_schema: Tool;
  };
  runSubAgent: (args: {
    agent: ToolLoopAgent<any, any, any>;
    prompt: string;
    store: AiStore<TState>;
    parentToolCallId: string;
    abortSignal?: AbortSignal;
  }) => Promise<AgentRunResult>;
  instructions?: string;
  /**
   * Optional host/plugin instructions appended after the built-in agent prompt.
   * Use this when extending an agent with extra tools that need specialized
   * usage guidance while preserving the base workflow.
   */
  additionalInstructions?: string;
  chartToolsOptions?: ChartToolsOptions;
};
