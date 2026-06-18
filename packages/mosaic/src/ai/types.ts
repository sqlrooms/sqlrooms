import type {LanguageModel, Tool, ToolLoopAgent} from 'ai';
import type {DataTable, QualifiedTableName} from '@sqlrooms/db';
import type {ChartTypeDefinition} from '../charts/chart-types';

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
