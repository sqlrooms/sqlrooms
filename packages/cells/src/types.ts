import type React from 'react';
import {z} from 'zod';
import type {StateCreator} from '@sqlrooms/room-store';
import type {BaseRoomStoreState} from '@sqlrooms/room-shell';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';

/** Cell types */
export const CellTypes = z.enum(['sql', 'text', 'vega', 'input']);
export type CellTypes = z.infer<typeof CellTypes>;

/** Input Cell types */
export const InputTypes = z.enum(['text', 'slider', 'dropdown']);
export type InputTypes = z.infer<typeof InputTypes>;

export const InputTextSchema = z.object({
  kind: z.literal(InputTypes.enum.text),
  varName: z.string(),
  value: z.string().default(''),
});
export type InputText = z.infer<typeof InputTextSchema>;

export const InputSliderSchema = z.object({
  kind: z.literal(InputTypes.enum.slider),
  varName: z.string(),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  value: z.number().default(0),
});
export type InputSlider = z.infer<typeof InputSliderSchema>;

export const InputDropdownSchema = z.object({
  kind: z.literal(InputTypes.enum.dropdown),
  varName: z.string(),
  options: z.array(z.string()).default([]),
  value: z.string().default(''),
});
export type InputDropdown = z.infer<typeof InputDropdownSchema>;

export const InputUnionSchema = z.discriminatedUnion('kind', [
  InputTextSchema,
  InputSliderSchema,
  InputDropdownSchema,
]);
export type InputUnion = z.infer<typeof InputUnionSchema>;

/** SQL Cell */
export const SqlCellDataSchema = z.object({
  title: z.string().default('Untitled'),
  sql: z.string().default(''),
});
export type SqlCellData = z.infer<typeof SqlCellDataSchema>;

/** Text Cell */
export const TextCellDataSchema = z.object({
  title: z.string().default('Text'),
  text: z.string().default(''),
});
export type TextCellData = z.infer<typeof TextCellDataSchema>;

/** Vega Cell */
export const VegaCellDataSchema = z.object({
  title: z.string().default('Chart'),
  sqlId: z.string().optional(), // In notebook, it links to another cell. In canvas, it might be the same.
  sql: z.string().optional(), // In canvas, it often has its own SQL.
  vegaSpec: z.any().optional(),
});
export type VegaCellData = z.infer<typeof VegaCellDataSchema>;

/** Input Cell Data */
export const InputCellDataSchema = z.object({
  title: z.string().default('Input'),
  input: InputUnionSchema,
});
export type InputCellData = z.infer<typeof InputCellDataSchema>;

/** Unified Cell Data */
export const CellDataSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('sql'), data: SqlCellDataSchema}),
  z.object({type: z.literal('text'), data: TextCellDataSchema}),
  z.object({type: z.literal('vega'), data: VegaCellDataSchema}),
  z.object({type: z.literal('input'), data: InputCellDataSchema}),
]);
export type CellData = z.infer<typeof CellDataSchema>;

export type SqlCell = {id: string; type: 'sql'; data: SqlCellData};
export type TextCell = {id: string; type: 'text'; data: TextCellData};
export type VegaCell = {id: string; type: 'vega'; data: VegaCellData};
export type InputCell = {id: string; type: 'input'; data: InputCellData};

/** Canonical Cell */
export const CellSchema = z
  .object({
    id: z.string(),
  })
  .and(CellDataSchema);
export type Cell = z.infer<typeof CellSchema>;

/** Unified Cell Registry */
export type CellContainerProps = {
  header?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
};

export type CellRegistryItem<TCell extends Cell = Cell> = {
  type: string;
  title: string;
  createCell: (id: string) => TCell;
  renderCell: (props: {
    id: string;
    cell: TCell;
    renderContainer: (props: CellContainerProps) => React.ReactElement;
  }) => React.ReactElement;
  /** Find dependencies for DAG - each cell type defines its own logic */
  findDependencies: (args: {
    cell: TCell;
    cells: Record<string, Cell>;
    sheetId: string;
  }) => string[];
  /** Optional: custom execution logic (defaults to SQL execution for sql type) */
  runCell?: (args: {id: string; opts?: {cascade?: boolean}}) => Promise<void>;
};

export type CellRegistry = Record<string, CellRegistryItem<any>>;

/** Sheet and Edge types */
export const SheetTypeSchema = z.enum(['notebook', 'canvas', 'cell']);
export type SheetType = z.infer<typeof SheetTypeSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(), // cellId
  target: z.string(), // cellId
});
export type Edge = z.infer<typeof EdgeSchema>;

export const SheetSchema = z.object({
  id: z.string(),
  type: SheetTypeSchema,
  title: z.string(),
  cellIds: z.array(z.string()).default([]), // Which cells belong to this sheet
  edges: z.array(EdgeSchema).default([]), // Dependencies
});
export type Sheet = z.infer<typeof SheetSchema>;

/** Cell Status */
export const SqlCellStatusSchema = z.object({
  type: z.literal('sql'),
  status: z.enum(['idle', 'running', 'success', 'cancel', 'error']),
  lastError: z.string().optional(),
  referencedTables: z.array(z.string()).default([]),
  resultName: z.string().optional(),
  resultView: z.string().optional(),
  lastRunTime: z.number().optional(),
});
export type SqlCellStatus = z.infer<typeof SqlCellStatusSchema>;

export const OtherCellStatusSchema = z.object({
  type: z.literal('other'),
});
export type OtherCellStatus = z.infer<typeof OtherCellStatusSchema>;

export const CellStatusSchema = z.union([
  SqlCellStatusSchema,
  OtherCellStatusSchema,
]);
export type CellStatus = z.infer<typeof CellStatusSchema>;

/** DAG Types */
export type DagDefinition<TCell, TMeta = unknown> = {
  id: string;
  cells: Record<string, TCell>;
  meta: TMeta;
};

export type DagConfig<TCell, TMeta = unknown> = {
  dags: Record<string, DagDefinition<TCell, TMeta>>;
  dagOrder: string[];
  currentDagId?: string;
};

export type DagSliceState = {
  dag: {
    currentDagId?: string;
    getDownstream: (dagId: string, sourceCellId: string) => string[];
    getRootCells: (dagId: string) => string[];
    runAllCellsCascade: (dagId: string) => Promise<void>;
    runDownstreamCascade: (
      dagId: string,
      sourceCellId: string,
    ) => Promise<void>;
  };
};

export type DagSliceOptions<TRootState, TCell, TMeta> = {
  getDagConfig: (state: TRootState) => DagConfig<TCell, TMeta> | undefined;
  findDependencies: (args: {
    dagId: string;
    cellId: string;
    cell: TCell;
    cells: Record<string, TCell>;
    getState: () => TRootState;
  }) => string[];
  runCell: (args: {
    dagId: string;
    cellId: string;
    cascade?: boolean;
    getState: () => TRootState;
  }) => Promise<void>;
};

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

export type SqlCellBodyStatus =
  | {
      state: 'idle' | 'running' | 'success' | 'cancel' | 'error';
      message?: string;
      resultName?: string;
    }
  | undefined;

/**
 * Props for rendering the editable SQL cell body and its results.
 */
export type SqlCellBodyProps = {
  sql: string;
  onSqlChange: (sql: string) => void;
  onRun: () => void;
  onCancel?: () => void;
  status?: SqlCellBodyStatus;
  resultName?: string;
  renderResult?: React.ReactNode;
  runLabel?: string;
  disabled?: boolean;
};

/**
 * Props for the standalone run/cancel control used by SQL cells.
 */
export type SqlCellRunButtonProps = Pick<
  SqlCellBodyProps,
  'onRun' | 'onCancel' | 'status' | 'runLabel' | 'disabled'
>;

export const CellsSliceConfigSchema = z.object({
  data: z.record(z.string(), CellSchema).default({}),
  sheets: z.record(z.string(), SheetSchema).default({}),
  sheetOrder: z.array(z.string()).default([]),
  currentSheetId: z.string().optional(),
});
export type CellsSliceConfig = z.infer<typeof CellsSliceConfigSchema>;

export type CellsSliceState = {
  cells: {
    config: CellsSliceConfig;
    status: Record<string, CellStatus>;
    activeAbortControllers: Record<string, AbortController>;
    cellRegistry: CellRegistry;

    // Cell CRUD
    addCell: (sheetId: string, cell: Cell, index?: number) => void;
    removeCell: (id: string) => void;
    updateCell: (id: string, updater: (cell: Cell) => Cell) => void;

    // Sheet CRUD
    addSheet: (title?: string, type?: SheetType) => string;
    removeSheet: (sheetId: string) => void;
    renameSheet: (sheetId: string, title: string) => void;
    setCurrentSheet: (sheetId: string) => void;

    // Edge management
    addEdge: (sheetId: string, edge: Omit<Edge, 'id'>) => void;
    removeEdge: (sheetId: string, edgeId: string) => void;
    updateEdgesFromSql: (sheetId: string, cellId: string) => void;

    // Execution
    runCell: (
      id: string,
      opts?: {cascade?: boolean; schemaName?: string},
    ) => Promise<void>;
    cancelCell: (id: string) => void;
  };
};

export type CellsRootState = BaseRoomStoreState &
  DuckDbSliceState &
  CellsSliceState &
  DagSliceState;

export type DagStateCreator<T> = StateCreator<T>;
