import {castDraft, produce} from 'immer';
import type * as arrow from 'apache-arrow';
import type {Dispatch, SetStateAction} from 'react';
import {createStore} from 'zustand/vanilla';
import type {DataTableExplorerCountState} from './DataTableExplorerCountClient';
import type {DataTableExplorerPageState} from './DataTableExplorerPageClient';
import type {
  DataTableExplorerPaginationState,
  DataTableExplorerSorting,
  DataTableExplorerSummaryState,
} from './types';
import {
  createEmptySummaryState,
  normalizeDataTableExplorerPagination,
} from './utils';

function resolveSetStateAction<T>(next: SetStateAction<T>, previous: T): T {
  // Preserve React-style setter semantics so hook callers can pass either
  // a concrete value or an updater function to the local dataTableExplorer store.
  return typeof next === 'function'
    ? (next as (value: T) => T)(previous)
    : next;
}

export type DataTableExplorerStoreState = {
  filteredCount: DataTableExplorerCountState;
  lastNonEmptyPageTable?: {
    datasetId: string;
    pageTable: arrow.Table;
  };
  page: DataTableExplorerPageState;
  pagination: DataTableExplorerPaginationState;
  schema: {
    error?: Error;
    fields: arrow.Field[];
    isLoading: boolean;
  };
  setFilteredCount: (state: DataTableExplorerCountState) => void;
  setPage: (state: DataTableExplorerPageState) => void;
  setPagination: Dispatch<SetStateAction<DataTableExplorerPaginationState>>;
  setSchemaError: (error?: Error) => void;
  setSchemaLoading: (isLoading: boolean) => void;
  setSchemaSuccess: (fields: arrow.Field[]) => void;
  setSorting: Dispatch<SetStateAction<DataTableExplorerSorting>>;
  setSummary: (
    fieldName: string,
    summary: DataTableExplorerSummaryState,
  ) => void;
  setTotalCount: (state: DataTableExplorerCountState) => void;
  sorting: DataTableExplorerSorting;
  summaries: Record<string, DataTableExplorerSummaryState>;
  syncPageSize: (pageSize: number) => void;
  totalCount: DataTableExplorerCountState;
  clearSummaries: () => void;
  initializeSummaries: (fields: arrow.Field[]) => void;
  resetPageIndex: () => void;
};

export type DataTableExplorerStore = ReturnType<
  typeof createDataTableExplorerStore
>;

/**
 * Creates a dataTableExplorer-local vanilla Zustand store that aggregates schema, row,
 * count, and summary state for a single `useDataTableExplorer()` instance.
 */
export function createDataTableExplorerStore(options: {
  initialSorting?: DataTableExplorerSorting;
  pageSize: number;
}) {
  const {initialSorting = [], pageSize} = options;

  return createStore<DataTableExplorerStoreState>((set) => ({
    filteredCount: {isLoading: false},
    lastNonEmptyPageTable: undefined,
    page: {isLoading: false},
    pagination: normalizeDataTableExplorerPagination({pageIndex: 0, pageSize}),
    schema: {
      fields: [],
      isLoading: false,
    },
    setFilteredCount: (nextState) => {
      set((state) =>
        produce(state, (draft) => {
          draft.filteredCount = nextState;
        }),
      );
    },
    setPage: (nextState) => {
      set((state) =>
        produce(state, (draft) => {
          draft.page = castDraft(nextState);
          if (
            nextState.datasetId &&
            nextState.pageTable &&
            nextState.pageTable.numRows > 0
          ) {
            draft.lastNonEmptyPageTable = {
              datasetId: nextState.datasetId,
              pageTable: castDraft(nextState.pageTable),
            };
          }
        }),
      );
    },
    setPagination: (next) => {
      set((state) =>
        produce(state, (draft) => {
          draft.pagination = normalizeDataTableExplorerPagination(
            resolveSetStateAction(next, state.pagination),
          );
        }),
      );
    },
    setSchemaError: (error) => {
      set((state) =>
        produce(state, (draft) => {
          draft.schema.error = error;
          draft.schema.isLoading = false;
        }),
      );
    },
    setSchemaLoading: (isLoading) => {
      set((state) =>
        produce(state, (draft) => {
          draft.schema.isLoading = isLoading;
          if (isLoading) {
            draft.schema.error = undefined;
          }
        }),
      );
    },
    setSchemaSuccess: (fields) => {
      set((state) =>
        produce(state, (draft) => {
          draft.schema.error = undefined;
          draft.schema.fields = fields;
          draft.schema.isLoading = false;
        }),
      );
    },
    setSorting: (next) => {
      set((state) =>
        produce(state, (draft) => {
          draft.sorting = resolveSetStateAction(next, state.sorting);
          draft.pagination.pageIndex = 0;
        }),
      );
    },
    setSummary: (fieldName, summary) => {
      set((state) =>
        produce(state, (draft) => {
          draft.summaries[fieldName] = summary;
        }),
      );
    },
    setTotalCount: (nextState) => {
      set((state) =>
        produce(state, (draft) => {
          draft.totalCount = nextState;
        }),
      );
    },
    sorting: initialSorting,
    summaries: {},
    syncPageSize: (nextPageSize) => {
      set((state) =>
        produce(state, (draft) => {
          if (draft.pagination.pageSize === nextPageSize) {
            return;
          }
          draft.pagination = normalizeDataTableExplorerPagination({
            pageIndex: 0,
            pageSize: nextPageSize,
          });
        }),
      );
    },
    totalCount: {isLoading: false},
    clearSummaries: () => {
      set((state) =>
        produce(state, (draft) => {
          draft.summaries = {};
        }),
      );
    },
    initializeSummaries: (fields) => {
      set((state) =>
        produce(state, (draft) => {
          draft.summaries = Object.fromEntries(
            fields.map((field) => [field.name, createEmptySummaryState(field)]),
          );
        }),
      );
    },
    resetPageIndex: () => {
      set((state) =>
        produce(state, (draft) => {
          draft.pagination = normalizeDataTableExplorerPagination({
            ...draft.pagination,
            pageIndex: 0,
          });
        }),
      );
    },
  }));
}
