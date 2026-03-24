import type {DbSliceState} from '@sqlrooms/db';
import type {BaseRoomStoreState, SliceFunctions} from '@sqlrooms/room-store';
import type * as arrow from 'apache-arrow';
import type React from 'react';
import {z} from 'zod';

/** Cell types */
export type BuiltInCellType = 'sql' | 'text' | 'vega' | 'input';
export type CellType = BuiltInCellType | (string & {});
export const CellType = z.string();

/** Input Cell types */
export const InputTypes = z.enum(['text', 'slider', 'dropdown']);
export type InputTypes = z.infer<typeof InputTypes>;

export const InputText = z.object({
  kind: z.literal(InputTypes.enum.text),
  varName: z.string(),
  value: z.string().default(''),
});
export type InputText = z.infer<typeof InputText>;

export const InputSlider = z.object({
  kind: z.literal(InputTypes.enum.slider),
  varName: z.string(),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  value: z.number().default(0),
});
export type InputSlider = z.infer<typeof InputSlider>;

export const InputDropdown = z.object({
  kind: z.literal(InputTypes.enum.dropdown),
  varName: z.string(),
  options: z.array(z.string()).default([]),
  value: z.string().default(''),
});
export type InputDropdown = z.infer<typeof InputDropdown>;

export const InputUnion = z.discriminatedUnion('kind', [
  InputText,
  InputSlider,
  InputDropdown,
]);
export type InputUnion = z.infer<typeof InputUnion>;

/** SQL Cell */
export const SqlCellData = z.object({
  title: z.string().default('Untitled'),
  sql: z.string().default(''),
  resultName: z.string().optional(), // SQL-friendly identifier for the result view
  connectorId: z.string().optional(),
});
export type SqlCellData = z.infer<typeof SqlCellData>;

/** Text Cell */
export const TextCellData = z.object({
  title: z.string().default('Text'),
  text: z.string().default(''),
});
export type TextCellData = z.infer<typeof TextCellData>;

/** Field type category for cross-filter predicates */
export type BrushFieldType = 'numeric' | 'temporal' | 'string';

/** Cross-filter configuration for Vega chart cells */
export const CrossFilterConfig = z.object({
  enabled: z.boolean().default(true),
  brushField: z.string().optional(),
  brushFieldType: z
    .enum(['numeric', 'temporal', 'string'])
    .optional() as z.ZodOptional<z.ZodType<BrushFieldType>>,
});
export type CrossFilterConfig = z.infer<typeof CrossFilterConfig>;

/** Vega Cell */
export const VegaCellData = z.object({
  title: z.string().default('Chart'),
  sqlId: z.string().optional(), // In notebook, it links to another cell. In canvas, it might be the same.
  sql: z.string().optional(), // In canvas, it often has its own SQL.
  vegaSpec: z.any().optional(),
  crossFilter: CrossFilterConfig.default({enabled: true}),
});
export type VegaCellData = z.infer<typeof VegaCellData>;

/** Input Cell Data */
export const InputCellData = z.object({
  title: z.string().default('Input'),
  input: InputUnion,
});
export type InputCellData = z.infer<typeof InputCellData>;

/** Unified Cell Data */
export const CellData = z.object({
  type: CellType,
  data: z.record(z.string(), z.any()),
});
export type CellData = {
  type: CellType;
  data: Record<string, any>;
};

export const SqlCell = z.object({
  id: z.string(),
  type: z.literal('sql'),
  data: SqlCellData,
});
export type SqlCell = z.infer<typeof SqlCell>;

export const TextCell = z.object({
  id: z.string(),
  type: z.literal('text'),
  data: TextCellData,
});
export type TextCell = z.infer<typeof TextCell>;

export const VegaCell = z.object({
  id: z.string(),
  type: z.literal('vega'),
  data: VegaCellData,
});
export type VegaCell = z.infer<typeof VegaCell>;

export const InputCell = z.object({
  id: z.string(),
  type: z.literal('input'),
  data: InputCellData,
});
export type InputCell = z.infer<typeof InputCell>;
export const SqlCellSchema = SqlCell;
export const TextCellSchema = TextCell;
export const VegaCellSchema = VegaCell;
export const InputCellSchema = InputCell;

/** Canonical Cell */
export const Cell = z.object({
  id: z.string(),
  type: CellType,
  data: z.record(z.string(), z.any()),
});
export type Cell = {
  id: string;
  type: CellType;
  data: Record<string, any>;
};

/** Unified Cell Registry */
export type CellContainerProps = {
  header?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
  showHeader?: boolean;
};

/** Type for SQL AST parsing function from DuckDB slice */
export type SqlSelectToJsonFn = (sql: string) => Promise<{
  error: boolean;
  error_type?: string;
  statements?: unknown[];
}>;

export type CreateCellArgs = {
  id: string;
  get: () => CellsRootState;
  set: (updater: (state: CellsRootState) => CellsRootState) => void;
};

export type CellRegistryItem<TCell extends Cell = Cell> = {
  type: string;
  title: string;
  createCell: (args: CreateCellArgs) => TCell;
  renderCell: (props: {
    id: string;
    cell: TCell;
    renderContainer: (props: CellContainerProps) => React.ReactElement;
  }) => React.ReactElement;
  /** Find dependencies for DAG using AST-enabled async resolution. */
  findDependencies: (args: {
    cell: TCell;
    cells: Record<string, Cell>;
    sheetId: string;
    sqlSelectToJson: SqlSelectToJsonFn;
  }) => Promise<string[]>;
  /** Optional: custom execution logic (defaults to SQL execution for sql type) */
  runCell?: (args: {
    id: string;
    opts?: {cascade?: boolean; schemaName?: string};
    get: () => CellsRootState;
    set: (updater: (state: CellsRootState) => CellsRootState) => void;
  }) => Promise<void>;
  /** Optional: rename the result view when resultName changes */
  renameResult?: (args: {
    id: string;
    oldResultView: string;
    get: () => CellsRootState;
    set: (updater: (state: CellsRootState) => CellsRootState) => void;
  }) => Promise<void>;

  /** Return initial CellStatus when a cell is first added. Default: {type:'other'} */
  createStatus?: (id: string) => CellStatus;
  /** Called once during cells.initialize() for each cell of this type. Reset ephemeral runtime state after hydration. */
  onInitialize?: (args: {
    id: string;
    status: CellStatus | undefined;
    get: () => CellsRootState;
    set: (updater: (state: CellsRootState) => CellsRootState) => void;
  }) => void;
  /** Called when cell is removed. Clean up DuckDB relations, caches, etc. */
  onRemove?: (args: {
    id: string;
    status: CellStatus | undefined;
    get: () => CellsRootState;
    set: (updater: (state: CellsRootState) => CellsRootState) => void;
  }) => Promise<void> | void;
  /** Detect whether an updateCell change is semantically significant for this cell type. */
  hasSemanticChange?: (oldCell: TCell, newCell: TCell) => boolean;
  /** Reset status to idle/stale. Called by invalidateCellStatus. If not provided, status is set to {type:'other'}. */
  invalidateStatus?: (currentStatus: CellStatus) => CellStatus;
  /** Collect DuckDB relation names that should be dropped when this cell is removed. */
  getRelationsToDrop?: (status: CellStatus) => string[];
  /** Record an error on the cell status during cascade execution. */
  recordError?: (currentStatus: CellStatus, message: string) => CellStatus;
  /** Return the query relation name for paged fetches, if applicable. */
  getResultRelation?: (status: CellStatus) => string | undefined;
};

export type CellRegistry = Record<string, CellRegistryItem<any>>;

/** Sheet and Edge types */
export const SheetType = z.enum(['notebook', 'canvas', 'app', 'dashboard']);
export type SheetType = z.infer<typeof SheetType>;

export const EdgeKind = z.enum(['dependency', 'manual']);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const Edge = z.object({
  id: z.string(),
  source: z.string(), // cellId
  target: z.string(), // cellId
  kind: EdgeKind.optional(),
});
export type Edge = z.infer<typeof Edge>;

export const SheetGraphCache = z.object({
  dependencies: z.record(z.string(), z.array(z.string())).default({}),
  dependents: z.record(z.string(), z.array(z.string())).default({}),
  contentHashByCell: z.record(z.string(), z.string()).optional(),
});
export type SheetGraphCache = z.infer<typeof SheetGraphCache>;

export const Sheet = z.object({
  id: z.string(),
  type: SheetType,
  title: z.string(),
  schemaName: z.string().optional(),
  cellIds: z.array(z.string()).default([]), // Which cells belong to this sheet
  edges: z.array(Edge).default([]), // Dependencies
  graphCache: SheetGraphCache.optional(),
});
export type Sheet = z.infer<typeof Sheet>;

/** Cell Status */
export const SqlCellStatus = z.object({
  type: z.literal('sql'),
  status: z.enum(['idle', 'running', 'success', 'cancel', 'error']),
  lastError: z.string().optional(),
  referencedTables: z.array(z.string()).default([]),
  resultName: z.string().optional(),
  resultView: z.string().optional(),
  resultRelationType: z.enum(['view', 'table']).optional(),
  lastRunTime: z.number().optional(),
});
export type SqlCellStatus = z.infer<typeof SqlCellStatus>;

export const OtherCellStatus = z.object({
  type: z.literal('other'),
});
export type OtherCellStatus = z.infer<typeof OtherCellStatus>;

/** Extensible cell status -- each cell type defines its own shape with a discriminating `type` field. */
export type CellStatus = {type: string; [key: string]: unknown};

/** SQL execution results */
export type SqlRunResult = {
  resultName?: string;
  referencedTables?: string[];
  lastRunTime?: number;
};

export type SqlRunCallbacks = {
  onStart?: () => void;
  onSuccess?: (result: SqlRunResult) => void;
  onError?: (message: string) => void;
  onFinally?: () => void;
};

export type SqlRenderInput = {
  varName: string;
  value: string | number;
};

export type SqlDependencyOptions = {
  inputTypes?: string[];
  sqlTypes?: string[];
};

export type SqlCellRunStatus =
  | {
      state: 'idle' | 'running' | 'success' | 'cancel' | 'error';
      message?: string;
      resultName?: string;
    }
  | undefined;

export const CellsSliceConfig = z.object({
  data: z.record(z.string(), Cell).default({}),
  sheets: z.record(z.string(), Sheet).default({}),
  sheetOrder: z.array(z.string()).default([]),
  currentSheetId: z.string().optional(),
});
export type CellsSliceConfig = z.infer<typeof CellsSliceConfig>;

export type CellsSliceOptions = {
  config?: Partial<CellsSliceConfig>;
  cellRegistry: CellRegistry;
  supportedSheetTypes?: SheetType[];
};

/** Data stored for a cell's query result */
export type CellResultData = {
  arrowTable: arrow.Table;
  totalRows: number;
};

/** Cross-filter selection value emitted by a Vega chart brush */
export type CrossFilterSelection = {
  field: string;
  fieldType?: BrushFieldType;
  type: 'interval' | 'point';
  value: unknown;
};

export type CellsSliceState = {
  cells: SliceFunctions & {
    config: CellsSliceConfig;
    status: Record<string, CellStatus>;
    activeAbortControllers: Record<string, AbortController>;
    cellRegistry: CellRegistry;
    supportedSheetTypes: SheetType[];
    /** Monotonic counter per cell, incremented when a new execution result arrives. Used to trigger pagination reset and re-render. */
    resultVersion: Record<string, number>;
    /** Monotonic counter per cell, incremented when a pagination/sorting fetch completes. Used to trigger re-render without resetting pagination. */
    pageVersion: Record<string, number>;

    /**
     * Ephemeral cross-filter selections (not persisted).
     * Outer key: sqlId (the shared data source), inner key: chartCellId.
     */
    crossFilterSelections: Record<
      string,
      Record<string, CrossFilterSelection | null>
    >;
    setCrossFilterSelection: (
      chartCellId: string,
      sqlId: string,
      selection: CrossFilterSelection | null,
    ) => void;
    getCrossFilterPredicate: (
      chartCellId: string,
      sqlId: string,
    ) => string | null;
    clearCrossFilterGroup: (sqlId: string) => void;

    // Cell CRUD
    addCell: (sheetId: string, cell: Cell, index?: number) => Promise<void>;
    removeCell: (id: string) => void;
    updateCell: (
      id: string,
      updater: (cell: Cell) => Cell,
      opts?: {cascade?: boolean},
    ) => Promise<void>;

    // Sheet CRUD
    addSheet: (title?: string, type?: SheetType) => string;
    removeSheet: (sheetId: string) => void;
    closeSheet: (sheetId: string) => void;
    openSheet: (sheetId: string) => void;
    setSheetOrder: (sheetOrder: string[]) => void;
    renameSheet: (sheetId: string, title: string) => void;
    setCurrentSheet: (sheetId: string) => void;

    // Edge management
    addEdge: (sheetId: string, edge: Omit<Edge, 'id'>) => void;
    removeEdge: (sheetId: string, edgeId: string) => void;
    updateEdgesFromSql: (sheetId: string, cellId: string) => Promise<void>;

    // Execution
    runCell: (
      id: string,
      opts?: {cascade?: boolean; schemaName?: string},
    ) => Promise<void>;
    cancelCell: (id: string) => void;
    invalidateCellStatus: (id: string) => void;

    // Cell result cache
    setCellResult: (id: string, data: CellResultData) => void;
    setCellResultPage: (id: string, data: CellResultData) => void;
    getCellResult: (id: string) => CellResultData | undefined;
    clearCellResult: (id: string) => void;
    fetchCellResultPage: (
      id: string,
      pagination: {pageIndex: number; pageSize: number},
      sorting?: {id: string; desc: boolean}[],
    ) => Promise<void>;

    // DAG methods
    getDownstream: (sheetId: string, sourceCellId: string) => string[];
    getRootCells: (sheetId: string) => string[];
    runAllCellsCascade: (sheetId: string) => Promise<void>;
    runDownstreamCascade: (
      sheetId: string,
      sourceCellId: string,
    ) => Promise<void>;
  };
  // Slice lifecycle
  initialize?: () => Promise<void>;
};

export type CellsRootState = BaseRoomStoreState &
  DbSliceState &
  CellsSliceState;

export function isSqlCell(cell: Cell): cell is SqlCell {
  return cell.type === 'sql';
}

export function isTextCell(cell: Cell): cell is TextCell {
  return cell.type === 'text';
}

export function isVegaCell(cell: Cell): cell is VegaCell {
  return cell.type === 'vega';
}

export function isInputCell(cell: Cell): cell is InputCell {
  return cell.type === 'input';
}
