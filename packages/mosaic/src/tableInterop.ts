import {decodeIPC} from '@uwdata/mosaic-core';
import {
  tableToIPC as mosaicTableToIPC,
  type Table as MosaicTable,
} from '@uwdata/flechette';
import {tableFromIPC, tableToIPC, type Table as ArrowTable} from 'apache-arrow';

const TABLE_INTEROP = Symbol.for('@sqlrooms/mosaic-table-interop');

type TableInterop = {
  ipcBytes: Uint8Array;
  getArrowTable: () => ArrowTable;
  getMosaicTable: () => object;
};

function attachTableInterop<T extends object>(
  table: T,
  options: {
    ipcBytes: Uint8Array;
    decodeArrowTable?: (ipcBytes: Uint8Array) => ArrowTable;
  },
): T {
  if (getTableInterop(table)) {
    return table;
  }

  const {ipcBytes, decodeArrowTable = (bytes) => tableFromIPC(bytes)} = options;
  let arrowTable: ArrowTable | undefined;

  const interop: TableInterop = {
    ipcBytes,
    getArrowTable: () => {
      arrowTable ??= decodeArrowTable(ipcBytes);
      return arrowTable;
    },
    getMosaicTable: () => table,
  };

  Object.defineProperty(table, TABLE_INTEROP, {
    value: interop,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return table;
}

export function getTableInterop(value: unknown): TableInterop | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return (value as {[TABLE_INTEROP]?: TableInterop})[TABLE_INTEROP];
}

export function getArrowTableFromInterop(
  value: unknown,
): ArrowTable | undefined {
  return getTableInterop(value)?.getArrowTable();
}

function isArrowTable(value: unknown): value is ArrowTable {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as {batches?: unknown}).batches),
  );
}

function isMosaicTable(value: unknown): value is MosaicTable {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as {toColumns?: unknown}).toColumns === 'function' &&
    typeof (value as {getChild?: unknown}).getChild === 'function',
  );
}

/**
 * Convert an Apache Arrow table into the Mosaic-native table shape while
 * attaching Mosaic-internal IPC-backed interop metadata.
 *
 * Mosaic core expects Flechette tables, while SQLRooms public client APIs
 * expose Apache Arrow. IPC remains the durable bridge. The original Arrow
 * table is referenced weakly so Arrow-native callers can often reuse it
 * without forcing Mosaic-only consumers to retain both table runtimes.
 */
export function createMosaicTableFromArrowTable(
  arrowTable: ArrowTable,
): MosaicTable {
  const ipcBytes = tableToIPC(arrowTable, 'stream');
  const arrowTableRef =
    typeof WeakRef === 'undefined' ? undefined : new WeakRef(arrowTable);

  return attachTableInterop(decodeIPC(ipcBytes), {
    ipcBytes,
    decodeArrowTable: (bytes) => arrowTableRef?.deref() ?? tableFromIPC(bytes),
  }) as MosaicTable;
}

/**
 * Convert a raw Mosaic client result to the Apache Arrow shape exposed by
 * SQLRooms public hooks.
 *
 * Results produced by {@link createMosaicTableFromArrowTable} use the
 * interop fast path. Plain third-party Flechette tables are still accepted as
 * a compatibility fallback, but that path has to re-encode through IPC.
 */
export function toArrowClientResult(value: unknown): ArrowTable {
  if (isArrowTable(value)) {
    return value;
  }

  const interopArrowTable = getArrowTableFromInterop(value);
  if (interopArrowTable) {
    return interopArrowTable;
  }

  if (isMosaicTable(value)) {
    return tableFromIPC(mosaicTableToIPC(value, {format: 'stream'}));
  }

  throw new Error(
    'useMosaicClient expected a Mosaic table result that can be converted to Apache Arrow.',
  );
}
