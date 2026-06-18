import type {BlockDocumentBlock} from '@sqlrooms/documents';
import type {DataTable} from '@sqlrooms/db';
import type {BaseMosaicAiAdapter, BaseAgentToolOptions} from './types';

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
  ): AddDashboardBlockResult;
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
