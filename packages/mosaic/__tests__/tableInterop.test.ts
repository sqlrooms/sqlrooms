import {Table, vectorFromArray} from 'apache-arrow';
import {tableFromArrays} from '@uwdata/flechette';
import {
  createMosaicTableFromArrowTable,
  getArrowTableFromInterop,
  getTableInterop,
  toArrowClientResult,
} from '../src/tableInterop';

describe('createMosaicTableFromArrowTable', () => {
  it('attaches Mosaic interop metadata and reuses the source Arrow table while it is alive', () => {
    const arrowTable = new Table({
      value: vectorFromArray([1, 2, 3]),
    });

    const mosaicTable = createMosaicTableFromArrowTable(arrowTable);
    const interop = getTableInterop(mosaicTable);

    expect(interop).toBeTruthy();
    expect(interop?.ipcBytes).toBeInstanceOf(Uint8Array);
    expect(interop?.getMosaicTable()).toBe(mosaicTable);

    const firstArrowTable = getArrowTableFromInterop(mosaicTable);
    const secondArrowTable = getArrowTableFromInterop(mosaicTable);

    expect(firstArrowTable).toBe(arrowTable);
    expect(secondArrowTable).toBe(firstArrowTable);
  });

  it('converts interop-backed Mosaic client results to Apache Arrow', () => {
    const arrowTable = new Table({
      value: vectorFromArray([1, 2, 3]),
    });

    const mosaicTable = createMosaicTableFromArrowTable(arrowTable);

    expect(toArrowClientResult(mosaicTable)).toBe(arrowTable);
  });

  it('converts plain Flechette tables as a compatibility fallback', () => {
    const mosaicTable = tableFromArrays({
      value: [1, 2, 3],
    });

    const arrowTable = toArrowClientResult(mosaicTable);

    expect(arrowTable).toBeInstanceOf(Table);
    expect(arrowTable.getChild('value')?.get(1)).toBe(2);
  });

  it('rejects non-table client results', () => {
    expect(() => toArrowClientResult({not: 'a table'})).toThrow(
      'useMosaicClient expected a Mosaic table result',
    );
  });
});
