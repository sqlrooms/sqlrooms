import type {Tool} from 'ai';
import type {BlockDocumentBlock, BlockDocumentNode} from '@sqlrooms/documents';
import type {BaseAgentToolOptions} from '../types';
import {DatabaseAiAdapter} from '../database-types';
import {AgentResultMetadata} from '../tool-types';

/**
 * Worksheet-specific AI types
 */

type AddDashboardBlockResult = {
  dashboardId: string;
  blockId: string;
};

/**
 * Worksheet adapter for managing worksheet artifacts (block documents).
 * Worksheets are collections of blocks, not panels.
 * Worksheet adapter manages its own state internally via the store.
 */
export type WorksheetAiAdapter = {
  /** Set the current active worksheet */
  setCurrentWorksheet(worksheetId: string): void;

  /** Ensure worksheet's block document exists */
  ensureWorksheet(worksheetId: string): void;

  /** Get worksheet's blocks */
  getBlocks(worksheetId: string): BlockDocumentNode[] | undefined;

  /** Add a block to the worksheet */
  addBlock(worksheetId: string, block: BlockDocumentBlock): string;

  /** Add a dashboard block to the worksheet */
  addDashboardBlock(
    worksheetId: string,
    title: string,
    tableName: string,
    intent?: string,
  ): AddDashboardBlockResult;

  addDataTableExplorerBlock: (
    worksheetId: string,
    title: string,
    tableName: string,
    intent?: string,
  ) => string;
};

/**
 * Result returned by the worksheet agent after completing a task.
 * Contains execution status, final output, and optional metadata about the run.
 */
export type WorksheetAgentResult = {
  success: boolean;
  finalOutput: string;
  worksheetId: string;
  error?: string;
  metadata?: AgentResultMetadata;
};

/**
 * Parameters passed to extra worksheet AI tools factory.
 * Provides adapters for worksheet and database operations.
 */
export type ExtraWorksheetAiToolsParams = {
  /** ID of the worksheet being edited by this worksheet agent run. */
  worksheetId: string;
  worksheetAdapter: WorksheetAiAdapter;
  databaseAdapter: DatabaseAiAdapter;
};

/**
 * Factory function for creating additional worksheet AI tools.
 * Allows hosts to register custom tools that extend the worksheet agent's capabilities.
 */
export type ExtraWorksheetAiToolsFactory = (
  params: ExtraWorksheetAiToolsParams,
) => Record<string, Tool>;

/**
 * Options for creating a worksheet agent tool.
 * Extends base agent options with worksheet-specific adapters and tools.
 */
export type CreateWorksheetAgentToolOptions<TState> =
  BaseAgentToolOptions<TState> & {
    worksheetAdapter: WorksheetAiAdapter;
    databaseAdapter: DatabaseAiAdapter;
    dashboardAgentTool: Tool;
    /**
     * Whether the worksheet agent should expose built-in HTML app block tools
     * and instructions. Defaults to `true` for existing integrations. Hosts
     * can set this to `false` when HTML app blocks are behind a feature gate.
     */
    htmlAppBlocksEnabled?: boolean;
    /**
     * Whether direct worksheet map block tools are available. When enabled,
     * map requests should use the host-provided map block tool instead of
     * creating a dashboard block solely to contain a map.
     */
    mapBlocksEnabled?: boolean;
    /**
     * Host-provided worksheet tools keyed by their registered tool name.
     * Register custom tools (e.g., maps, charts, data loaders) to extend
     * the worksheet agent's capabilities.
     */
    extraTools?: ExtraWorksheetAiToolsFactory;
  };
