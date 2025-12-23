import type React from 'react';
import {z} from 'zod';
import type {StateCreator} from '@sqlrooms/room-store';
import type {BaseRoomStoreState} from '@sqlrooms/room-shell';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';

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
});
export type SqlCellData = z.infer<typeof SqlCellData>;

/** Text Cell */
export const TextCellData = z.object({
  title: z.string().default('Text'),
  text: z.string().default(''),
});
export type TextCellData = z.infer<typeof TextCellData>;

/** Vega Cell */
export const VegaCellData = z.object({
  title: z.string().default('Chart'),
  sqlId: z.string().optional(), // In notebook, it links to another cell. In canvas, it might be the same.
  sql: z.string().optional(), // In canvas, it often has its own SQL.
  vegaSpec: z.any().optional(),
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
  data: z.record(z.string(), z.unknown()),
});
export type CellData = {
  type: CellType;
  data: Record<string, any>;
};

export type SqlCell = {id: string; type: 'sql'; data: SqlCellData};
export type TextCell = {id: string; type: 'text'; data: TextCellData};
export type VegaCell = {id: string; type: 'vega'; data: VegaCellData};
export type InputCell = {id: string; type: 'input'; data: InputCellData};

/** Canonical Cell */
export const Cell = z.object({
  id: z.string(),
  type: CellType,
  data: z.record(z.string(), z.unknown()),
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
export const SheetType = z.enum(['notebook', 'canvas']);
export type SheetType = z.infer<typeof SheetType>;

export const Edge = z.object({
  id: z.string(),
  source: z.string(), // cellId
  target: z.string(), // cellId
});
export type Edge = z.infer<typeof Edge>;

export const Sheet = z.object({
  id: z.string(),
  type: SheetType,
  title: z.string(),
  cellIds: z.array(z.string()).default([]), // Which cells belong to this sheet
  edges: z.array(Edge).default([]), // Dependencies
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
  lastRunTime: z.number().optional(),
});
export type SqlCellStatus = z.infer<typeof SqlCellStatus>;

export const OtherCellStatus = z.object({
  type: z.literal('other'),
});
export type OtherCellStatus = z.infer<typeof OtherCellStatus>;

export const CellStatus = z.union([SqlCellStatus, OtherCellStatus]);
export type CellStatus = z.infer<typeof CellStatus>;

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

export const CellsSliceConfig = z.object({
  data: z.record(z.string(), Cell).default({}),
  sheets: z.record(z.string(), Sheet).default({}),
  sheetOrder: z.array(z.string()).default([]),
  currentSheetId: z.string().optional(),
});
export type CellsSliceConfig = z.infer<typeof CellsSliceConfig>;

export type CellsSliceOptions = {
  cellRegistry: CellRegistry;
  supportedSheetTypes?: SheetType[];
};

export type CellsSliceState = {
  cells: {
    config: CellsSliceConfig;
    status: Record<string, CellStatus>;
    activeAbortControllers: Record<string, AbortController>;
    cellRegistry: CellRegistry;
    supportedSheetTypes: SheetType[];

    // Cell CRUD
    addCell: (sheetId: string, cell: Cell, index?: number) => void;
    removeCell: (id: string) => void;
    updateCell: (id: string, updater: (cell: Cell) => Cell) => void;

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
    updateEdgesFromSql: (sheetId: string, cellId: string) => void;

    // Execution
    runCell: (
      id: string,
      opts?: {cascade?: boolean; schemaName?: string},
    ) => Promise<void>;
    cancelCell: (id: string) => void;

    // DAG methods
    getDownstream: (sheetId: string, sourceCellId: string) => string[];
    getRootCells: (sheetId: string) => string[];
    runAllCellsCascade: (sheetId: string) => Promise<void>;
    runDownstreamCascade: (
      sheetId: string,
      sourceCellId: string,
    ) => Promise<void>;
  };
};

export type CellsRootState = BaseRoomStoreState &
  DuckDbSliceState &
  CellsSliceState;
