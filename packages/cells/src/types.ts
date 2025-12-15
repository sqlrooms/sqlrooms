import type React from 'react';
import type {StateCreator} from '@sqlrooms/room-store';

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

export type RegistryItem<TCell> = {
  title: string;
  createCell: (id: string) => TCell;
  renderComponent?: (id: string) => React.ReactElement;
  findDependencies?: (
    cell: TCell,
    cells: Record<string, TCell>,
    status: Record<string, unknown>,
  ) => string[];
  runCell?: (args: {id: string; opts?: {cascade?: boolean}}) => Promise<void>;
};

export type SqlCellStatus =
  | {
      type: 'sql';
      status: 'idle' | 'running' | 'success' | 'cancel' | 'error';
      lastError?: string;
      referencedTables?: string[];
      resultName?: string;
      resultView?: string;
      lastRunTime?: number;
    }
  | {type: 'other'};

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

export type DagStateCreator<T> = StateCreator<T>;
