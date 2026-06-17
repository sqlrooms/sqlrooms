import type {MosaicClient, Selection} from '@uwdata/mosaic-core';
import {queryFieldInfo} from '@uwdata/mosaic-core';
import type * as arrow from 'apache-arrow';
import {
  DataTableExplorerCategoryClient,
  DataTableExplorerCategoryTotalClient,
} from './DataTableExplorerCategoryClient';
import {DataTableExplorerCountClient} from './DataTableExplorerCountClient';
import {
  DataTableExplorerHistogramClient,
  DataTableExplorerHistogramTotalClient,
} from './DataTableExplorerHistogramClient';
import {DataTableExplorerPageClient} from './DataTableExplorerPageClient';
import {DataTableExplorerUnsupportedSummaryClient} from './DataTableExplorerUnsupportedSummaryClient';
import type {
  DataTableExplorerSummaryState,
  DataTableExplorerSorting,
} from './types';
import type {DataTableExplorerStore} from './createDataTableExplorerStore';
import {
  fieldInfoToDataTableExplorerField,
  getDataTableExplorerValueType,
  isDataTableExplorerHistogramType,
  isDataTableExplorerUnsupportedSummaryType,
} from './utils';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Loads field metadata for the dataTableExplorer table and writes the normalized field
 * definitions into the dataTableExplorer store.
 */
export async function loadDataTableExplorerSchema(options: {
  columns?: string[];
  coordinator: Parameters<typeof queryFieldInfo>[0];
  store: DataTableExplorerStore;
  tableName: string;
}) {
  const {columns, coordinator, store, tableName} = options;
  store.getState().setSchemaLoading(true, tableName);

  try {
    const fieldInfo = await queryFieldInfo(
      coordinator,
      columns?.length
        ? columns.map((column) => ({column, table: tableName}))
        : [{column: '*', table: tableName}],
    );
    store
      .getState()
      .setSchemaSuccess(
        fieldInfo.map(fieldInfoToDataTableExplorerField),
        tableName,
      );
  } catch (error: unknown) {
    store.getState().setSchemaSuccess([], tableName);
    store.getState().setSchemaError(toError(error), tableName);
  }
}

type ReadyConnection = {
  coordinator: {
    connect: (client: MosaicClient) => void;
    disconnect: (client: MosaicClient) => void;
  };
};

/**
 * Connects the paged row client for the current dataTableExplorer page and disconnects
 * it when the caller tears down the lifecycle.
 */
export function connectDataTableExplorerPageClient(options: {
  connection: ReadyConnection;
  fieldNames: string[];
  filter?: ReturnType<Selection['predicate']>;
  pagination: {pageIndex: number; pageSize: number};
  sorting: DataTableExplorerSorting;
  store: DataTableExplorerStore;
  tableName: string;
}) {
  const client = new DataTableExplorerPageClient({
    columns: options.fieldNames,
    filter: options.filter,
    onStateChange: (state) => options.store.getState().setPage(state),
    pagination: options.pagination,
    sorting: options.sorting,
    tableName: options.tableName,
  });

  options.connection.coordinator.connect(client);

  return () => {
    client.destroy();
  };
}

/**
 * Connects either the filtered or total count client and routes updates into
 * the corresponding store slice.
 */
export function connectDataTableExplorerCountClient(options: {
  connection: ReadyConnection;
  filterStable?: boolean;
  selection?: Selection;
  store: DataTableExplorerStore;
  tableName: string;
  target: 'filtered' | 'total';
}) {
  const setCountState =
    options.target === 'filtered'
      ? options.store.getState().setFilteredCount
      : options.store.getState().setTotalCount;

  const client = new DataTableExplorerCountClient({
    filterStable: options.filterStable,
    onStateChange: setCountState,
    selection: options.selection,
    tableName: options.tableName,
  });

  options.connection.coordinator.connect(client);

  return {
    client,
    cleanup: () => {
      client.destroy();
    },
  };
}

/**
 * Connects all per-column summary clients for the active schema and initializes
 * matching empty summary state in the dataTableExplorer store.
 */
export function connectDataTableExplorerSummaryClients(options: {
  categoryLimit: number;
  connection: ReadyConnection;
  fields: arrow.Field[];
  selection: Selection;
  store: DataTableExplorerStore;
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
    const update = (summary: DataTableExplorerSummaryState) => {
      store.getState().setSummary(field.name, summary);
    };

    if (isDataTableExplorerUnsupportedSummaryType(field.type)) {
      return [
        new DataTableExplorerUnsupportedSummaryClient({
          field,
          onStateChange: update,
          selection,
          tableName,
        }),
      ];
    }

    if (isDataTableExplorerHistogramType(field.type)) {
      const summaryClient = new DataTableExplorerHistogramClient({
        field,
        onStateChange: update,
        selection,
        steps: summaryBins,
        tableName,
        valueType:
          getDataTableExplorerValueType(field.type) === 'date'
            ? 'date'
            : 'number',
      });

      return [
        summaryClient,
        new DataTableExplorerHistogramTotalClient({
          summaryClient,
        }),
      ];
    }

    const summaryClient = new DataTableExplorerCategoryClient({
      categoryLimit,
      field,
      onStateChange: update,
      selection,
      tableName,
    });

    return [
      summaryClient,
      new DataTableExplorerCategoryTotalClient({
        summaryClient,
      }),
    ];
  });

  clients.forEach((client) => connection.coordinator.connect(client));

  return () => {
    clients.forEach((client) => client.destroy());
    store.getState().clearSummaries();
  };
}
