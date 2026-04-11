import {castDraft, produce} from 'immer';
import type * as arrow from 'apache-arrow';
import type {Dispatch, SetStateAction} from 'react';
import {createStore} from 'zustand/vanilla';
import type {ProfilerCountState} from './ProfilerCountClient';
import type {ProfilerPageState} from './ProfilerPageClient';
import type {
  MosaicProfilerPaginationState,
  MosaicProfilerSorting,
  MosaicProfilerSummaryState,
} from './types';
import {createEmptySummaryState, normalizeProfilerPagination} from './utils';

function resolveSetStateAction<T>(next: SetStateAction<T>, previous: T): T {
  // Preserve React-style setter semantics so hook callers can pass either
  // a concrete value or an updater function to the local profiler store.
  return typeof next === 'function'
    ? (next as (value: T) => T)(previous)
    : next;
}

export type ProfilerStoreState = {
  filteredCount: ProfilerCountState;
  lastNonEmptyPageTable?: arrow.Table;
  page: ProfilerPageState;
  pagination: MosaicProfilerPaginationState;
  schema: {
    error?: Error;
    fields: arrow.Field[];
    isLoading: boolean;
  };
  setFilteredCount: (state: ProfilerCountState) => void;
  setPage: (state: ProfilerPageState) => void;
  setPagination: Dispatch<SetStateAction<MosaicProfilerPaginationState>>;
  setSchemaError: (error?: Error) => void;
  setSchemaLoading: (isLoading: boolean) => void;
  setSchemaSuccess: (fields: arrow.Field[]) => void;
  setSorting: Dispatch<SetStateAction<MosaicProfilerSorting>>;
  setSummary: (fieldName: string, summary: MosaicProfilerSummaryState) => void;
  setTotalCount: (state: ProfilerCountState) => void;
  sorting: MosaicProfilerSorting;
  summaries: Record<string, MosaicProfilerSummaryState>;
  syncPageSize: (pageSize: number) => void;
  totalCount: ProfilerCountState;
  clearSummaries: () => void;
  initializeSummaries: (fields: arrow.Field[]) => void;
  resetPageIndex: () => void;
};

export type ProfilerStore = ReturnType<typeof createProfilerStore>;

/**
 * Creates a profiler-local vanilla Zustand store that aggregates schema, row,
 * count, and summary state for a single `useMosaicProfiler()` instance.
 */
export function createProfilerStore(options: {
  initialSorting?: MosaicProfilerSorting;
  pageSize: number;
}) {
  const {initialSorting = [], pageSize} = options;

  return createStore<ProfilerStoreState>((set) => ({
    filteredCount: {isLoading: false},
    lastNonEmptyPageTable: undefined,
    page: {isLoading: false},
    pagination: normalizeProfilerPagination({pageIndex: 0, pageSize}),
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
          if (nextState.pageTable && nextState.pageTable.numRows > 0) {
            draft.lastNonEmptyPageTable = castDraft(nextState.pageTable);
          }
        }),
      );
    },
    setPagination: (next) => {
      set((state) =>
        produce(state, (draft) => {
          draft.pagination = normalizeProfilerPagination(
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
          draft.pagination = normalizeProfilerPagination({
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
          draft.pagination = normalizeProfilerPagination({
            ...draft.pagination,
            pageIndex: 0,
          });
        }),
      );
    },
  }));
}
