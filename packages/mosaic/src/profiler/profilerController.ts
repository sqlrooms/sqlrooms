import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import {queryFieldInfo} from '@uwdata/mosaic-core';
import type * as arrow from 'apache-arrow';
import {
  ProfilerCategoryClient,
  ProfilerCategoryTotalClient,
} from './ProfilerCategoryClient';
import {ProfilerCountClient} from './ProfilerCountClient';
import {
  ProfilerHistogramClient,
  ProfilerHistogramTotalClient,
} from './ProfilerHistogramClient';
import {ProfilerPageClient} from './ProfilerPageClient';
import {ProfilerUnsupportedSummaryClient} from './ProfilerUnsupportedSummaryClient';
import type {MosaicProfilerSummaryState, MosaicProfilerSorting} from './types';
import type {ProfilerStore} from './createProfilerStore';
import {
  fieldInfoToProfilerField,
  getProfilerValueType,
  isProfilerHistogramType,
  isProfilerUnsupportedSummaryType,
} from './utils';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function loadProfilerSchema(options: {
  columns?: string[];
  coordinator: Parameters<typeof queryFieldInfo>[0];
  store: ProfilerStore;
  tableName: string;
}) {
  const {columns, coordinator, store, tableName} = options;
  store.getState().setSchemaLoading(true);

  try {
    const fieldInfo = await queryFieldInfo(
      coordinator,
      columns?.length
        ? columns.map((column) => ({column, table: tableName}))
        : [{column: '*', table: tableName}],
    );
    store.getState().setSchemaSuccess(fieldInfo.map(fieldInfoToProfilerField));
  } catch (error: unknown) {
    store.getState().setSchemaSuccess([]);
    store.getState().setSchemaError(toError(error));
  }
}

type ReadyConnection = {
  coordinator: {
    connect: (client: MosaicClient) => void;
    disconnect: (client: MosaicClient) => void;
  };
};

export function connectProfilerPageClient(options: {
  connection: ReadyConnection;
  fieldNames: string[];
  pagination: {pageIndex: number; pageSize: number};
  selection: Selection;
  sorting: MosaicProfilerSorting;
  store: ProfilerStore;
  tableName: string;
}) {
  const client = new ProfilerPageClient({
    columns: options.fieldNames,
    onStateChange: (state) => options.store.getState().setPage(state),
    pagination: options.pagination,
    selection: options.selection,
    sorting: options.sorting,
    tableName: options.tableName,
  });

  options.connection.coordinator.connect(client);

  return () => {
    options.connection.coordinator.disconnect(client);
  };
}

export function connectProfilerCountClient(options: {
  connection: ReadyConnection;
  filterStable?: boolean;
  selection?: Selection;
  store: ProfilerStore;
  tableName: string;
  target: 'filtered' | 'total';
}) {
  const setCountState =
    options.target === 'filtered'
      ? options.store.getState().setFilteredCount
      : options.store.getState().setTotalCount;

  const client = new ProfilerCountClient({
    filterStable: options.filterStable,
    onStateChange: setCountState,
    selection: options.selection,
    tableName: options.tableName,
  });

  options.connection.coordinator.connect(client);

  return () => {
    options.connection.coordinator.disconnect(client);
  };
}

export function connectProfilerSummaryClients(options: {
  categoryLimit: number;
  connection: ReadyConnection;
  fields: arrow.Field[];
  selection: Selection;
  store: ProfilerStore;
  summaryBins: number;
  tableName: string;
}) {
  const {
    categoryLimit,
    connection,
    fields,
    selection,
    store,
    summaryBins,
    tableName,
  } = options;

  store.getState().initializeSummaries(fields);

  const clients: MosaicClient[] = fields.flatMap((field): MosaicClient[] => {
    const update = (summary: MosaicProfilerSummaryState) => {
      store.getState().setSummary(field.name, summary);
    };

    if (isProfilerUnsupportedSummaryType(field.type)) {
      return [
        new ProfilerUnsupportedSummaryClient({
          field,
          onStateChange: update,
          selection,
          tableName,
        }),
      ];
    }

    if (isProfilerHistogramType(field.type)) {
      const summaryClient = new ProfilerHistogramClient({
        field,
        onStateChange: update,
        selection,
        steps: summaryBins,
        tableName,
        valueType:
          getProfilerValueType(field.type) === 'date' ? 'date' : 'number',
      });

      return [
        summaryClient,
        new ProfilerHistogramTotalClient({
          summaryClient,
        }),
      ];
    }

    const summaryClient = new ProfilerCategoryClient({
      categoryLimit,
      field,
      onStateChange: update,
      selection,
      tableName,
    });

    return [
      summaryClient,
      new ProfilerCategoryTotalClient({
        summaryClient,
      }),
    ];
  });

  clients.forEach((client) => connection.coordinator.connect(client));

  return () => {
    clients.forEach((client) => connection.coordinator.disconnect(client));
    store.getState().clearSummaries();
  };
}
