import {Selection, clausePoint} from '@uwdata/mosaic-core';
import {DataTableExplorerCountClient} from '../src/data-table-explorer/DataTableExplorerCountClient';
import {DataTableExplorerPageClient} from '../src/data-table-explorer/DataTableExplorerPageClient';
import {DataTableExplorerUnsupportedSummaryClient} from '../src/data-table-explorer/DataTableExplorerUnsupportedSummaryClient';

describe('dataTableExplorer query clients', () => {
  it('builds paged row SQL with sorting, limit, and offset', () => {
    const client = new DataTableExplorerPageClient({
      columns: ['id', 'status'],
      onStateChange: () => {},
      pagination: {pageIndex: 2, pageSize: 25},
      sorting: [{desc: true, id: 'status'}],
      tableName: 'issues',
    });

    const sql = client.query([]).toString();

    expect(sql).toContain('ORDER BY "status" DESC');
    expect(sql).toContain('LIMIT 25');
    expect(sql).toContain('OFFSET 50');
  });

  it('keeps the previous page table while a new row query is pending', () => {
    let latest: any;
    const previousPageTable = {numRows: 10};
    const client = new DataTableExplorerPageClient({
      columns: ['id'],
      onStateChange: (state) => {
        latest = state;
      },
      pagination: {pageIndex: 0, pageSize: 10},
      sorting: [],
      tableName: 'issues',
    });

    client.queryResult(previousPageTable);
    client.queryPending();

    expect(latest.isLoading).toBe(true);
    expect(latest.pageTable).toBe(previousPageTable);
  });

  it('applies the active selection predicate in the filtered count query', () => {
    const selection = Selection.crossfilter();
    selection.update(clausePoint('status', 'open', {source: {}}));

    const client = new DataTableExplorerCountClient({
      filterStable: true,
      onStateChange: () => {},
      selection,
      tableName: 'issues',
    });

    const sql = client.query(selection.predicate(client) as any).toString();

    expect(sql).toContain('count(*)');
    expect(sql).toContain('"status"');
    expect(sql).toContain('open');
  });

  it('keeps the total count query unfiltered', () => {
    const client = new DataTableExplorerCountClient({
      onStateChange: () => {},
      tableName: 'issues',
    });

    const sql = client.query([]).toString();

    expect(sql).toContain('count(*)');
    expect(sql).not.toContain('WHERE');
  });

  it('applies active filters to unsupported-summary distinct counts', () => {
    const selection = Selection.crossfilter();
    selection.update(clausePoint('status', 'open', {source: {}}));

    const client = new DataTableExplorerUnsupportedSummaryClient({
      field: {
        name: 'payload',
        type: {
          toString: () => 'Binary',
        },
      } as any,
      onStateChange: () => {},
      selection,
      tableName: 'issues',
    });

    const sql = client.query(selection.predicate(client) as any).toString();

    expect(sql).toContain('DISTINCT');
    expect(sql).toContain('"payload"');
    expect(sql).toContain('"status"');
    expect(sql).toContain('open');
  });

  it('marks only the safe dataTableExplorer query clients as filter-stable', () => {
    const selection = Selection.crossfilter();

    const page = new DataTableExplorerPageClient({
      columns: ['id'],
      onStateChange: () => {},
      pagination: {pageIndex: 0, pageSize: 10},
      sorting: [],
      tableName: 'issues',
    });
    const filteredCount = new DataTableExplorerCountClient({
      filterStable: true,
      onStateChange: () => {},
      selection,
      tableName: 'issues',
    });
    const totalCount = new DataTableExplorerCountClient({
      onStateChange: () => {},
      tableName: 'issues',
    });
    const unsupported = new DataTableExplorerUnsupportedSummaryClient({
      field: {
        name: 'payload',
        type: {
          toString: () => 'Binary',
        },
      } as any,
      onStateChange: () => {},
      selection,
      tableName: 'issues',
    });

    expect(page.filterStable).toBe(false);
    expect(filteredCount.filterStable).toBe(true);
    expect(totalCount.filterStable).toBe(false);
    expect(unsupported.filterStable).toBe(false);
  });
});
