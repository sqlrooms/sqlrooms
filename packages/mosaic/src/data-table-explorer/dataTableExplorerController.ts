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
  DataTableExplorerColumnKind,
  DataTableExplorerSummaryState,
  DataTableExplorerSqlTableReference,
  DataTableExplorerSorting,
} from './types';
import type {DataTableExplorerStore} from './createDataTableExplorerStore';
import {
  fieldInfoToDataTableExplorerField,
  getDataTableExplorerValueType,
  resolveDataTableExplorerColumnKind,
} from './utils';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Loads field metadata for the dataTableExplorer table and writes the normalized field
 * definitions into the dataTableExplorer store.
 *
 * @param options.columns Optional subset of column names to load. When omitted,
 * metadata is loaded for every column in the table.
 * @param options.coordinator Mosaic coordinator used to run the field-info query.
 * @param options.store Instance store that receives schema loading, success, and
 * error state.
 * @param options.tableIdentity Stable SQLRooms table identity used for store keys.
 * This should preserve catalog/database identity when available.
 * @param options.tableReference Mosaic SQL table reference used to query the table.
 * Prefer a TableRefNode for qualified table names so dotted identifier parts are
 * not reparsed as separate identifiers.
 */
export async function loadDataTableExplorerSchema(options: {
  columns?: string[];
  coordinator: Parameters<typeof queryFieldInfo>[0];
  store: DataTableExplorerStore;
  tableIdentity: string;
  tableReference: DataTableExplorerSqlTableReference;
}) {
  const {columns, coordinator, store, tableIdentity, tableReference} = options;
  store.getState().setSchemaLoading(true, tableIdentity);

  try {
    // queryFieldInfo is typed as string-only, but Mosaic's runtime accepts
    // TableRefNode values and preserves identifier boundaries for dotted names.
    const fieldInfoTable = tableReference as unknown as string;
    const fieldInfo = await queryFieldInfo(
      coordinator,
      columns?.length
        ? columns.map((column) => ({column, table: fieldInfoTable}))
        : [{column: '*', table: fieldInfoTable}],
    );
    store
      .getState()
      .setSchemaSuccess(
        fieldInfo.map(fieldInfoToDataTableExplorerField),
        tableIdentity,
      );
  } catch (error: unknown) {
    store.getState().setSchemaSuccess([], tableIdentity);
    store.getState().setSchemaError(toError(error), tableIdentity);
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
 *
 * @param options.connection Ready Mosaic connection that owns client
 * registration.
 * @param options.fieldNames Ordered fields to include in the page query and page
 * dataset identity.
 * @param options.filter Optional row filter applied to the page query.
 * @param options.pagination Current page index and page size.
 * @param options.sorting Current sort descriptors.
 * @param options.store Instance store that receives page loading, data, and error
 * state.
 * @param options.tableName Stable SQLRooms table identity used for page dataset
 * keys.
 * @param options.tableReference Mosaic SQL table reference used in generated page
 * queries.
 */
export function connectDataTableExplorerPageClient(options: {
  connection: ReadyConnection;
  fieldNames: string[];
  filter?: ReturnType<Selection['predicate']>;
  pagination: {pageIndex: number; pageSize: number};
  sorting: DataTableExplorerSorting;
  store: DataTableExplorerStore;
  tableName: string;
  tableReference: DataTableExplorerSqlTableReference;
}) {
  const client = new DataTableExplorerPageClient({
    columns: options.fieldNames,
    filter: options.filter,
    onStateChange: (state) => options.store.getState().setPage(state),
    pagination: options.pagination,
    sorting: options.sorting,
    tableName: options.tableName,
    tableReference: options.tableReference,
  });

  options.connection.coordinator.connect(client);

  return () => {
    client.destroy();
  };
}

/**
 * Connects either the filtered or total count client and routes updates into
 * the corresponding store slice.
 *
 * @param options.connection Ready Mosaic connection that owns client
 * registration.
 * @param options.filterStable Whether Mosaic can treat this count query as
 * stable under filter changes.
 * @param options.selection Optional Mosaic selection that supplies cross-filter
 * predicates.
 * @param options.store Instance store that receives filtered or total count
 * state.
 * @param options.tableName Stable SQLRooms table identity used for client state.
 * @param options.tableReference Mosaic SQL table reference used in generated count
 * queries.
 * @param options.target Selects whether updates go to the filtered or total count
 * store slice.
 */
export function connectDataTableExplorerCountClient(options: {
  connection: ReadyConnection;
  filterStable?: boolean;
  selection?: Selection;
  store: DataTableExplorerStore;
  tableName: string;
  tableReference: DataTableExplorerSqlTableReference;
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
    tableReference: options.tableReference,
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
 *
 * @param options.categoryLimit Maximum number of category buckets to expose before
 * grouping the remainder into an overflow bucket.
 * @param options.columnKinds Resolved summary kind per field name. Fields
 * missing from the map fall back to the Arrow-type-driven default. Columns
 * resolved to `'none'` get no summary clients, so no summary queries run for
 * them.
 * @param options.connection Ready Mosaic connection that owns summary client
 * registration.
 * @param options.fields Active Arrow fields to summarize.
 * @param options.selection Mosaic selection shared by summary clients.
 * @param options.store Instance store that receives summary state.
 * @param options.summaryBins Requested bin count for histogram summaries.
 * @param options.tableName Human-readable or string table reference kept for
 * summary clients that still accept string identities.
 * @param options.tableReference Mosaic SQL table reference used in generated
 * summary queries.
 */
export function connectDataTableExplorerSummaryClients(options: {
  categoryLimit: number;
  columnKinds?: Record<string, DataTableExplorerColumnKind>;
  connection: ReadyConnection;
  fields: arrow.Field[];
  selection: Selection;
  store: DataTableExplorerStore;
  summaryBins: number;
  tableName: string;
  tableReference: DataTableExplorerSqlTableReference;
}) {
  const {
    categoryLimit,
    columnKinds,
    connection,
    fields,
    selection,
    store,
    summaryBins,
    tableName,
    tableReference,
  } = options;

  store.getState().initializeSummaries(fields, columnKinds);

  const clients: MosaicClient[] = fields.flatMap((field): MosaicClient[] => {
    const kind =
      columnKinds?.[field.name] ?? resolveDataTableExplorerColumnKind(field);
    const update = (summary: DataTableExplorerSummaryState) => {
      store.getState().setSummary(field.name, summary);
    };

    if (kind === 'none') {
      return [];
    }

    if (kind === 'unsupported') {
      return [
        new DataTableExplorerUnsupportedSummaryClient({
          field,
          onStateChange: update,
          selection,
          tableName,
          tableReference,
        }),
      ];
    }

    if (kind === 'histogram') {
      const summaryClient = new DataTableExplorerHistogramClient({
        field,
        onStateChange: update,
        selection,
        steps: summaryBins,
        tableName,
        tableReference,
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
      tableReference,
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
