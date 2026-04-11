import {Selection, clausePoint} from '@uwdata/mosaic-core';
import {ProfilerCountClient} from '../src/profiler/ProfilerCountClient';
import {ProfilerPageClient} from '../src/profiler/ProfilerPageClient';
import {ProfilerUnsupportedSummaryClient} from '../src/profiler/ProfilerUnsupportedSummaryClient';

describe('profiler query clients', () => {
  it('builds paged row SQL with sorting, limit, and offset', () => {
    const client = new ProfilerPageClient({
      columns: ['id', 'status'],
      onStateChange: () => {},
      pagination: {pageIndex: 2, pageSize: 25},
      selection: Selection.crossfilter(),
      sorting: [{desc: true, id: 'status'}],
      tableName: 'issues',
    });

    const sql = client.query([]).toString();

    expect(sql).toContain('ORDER BY "status" DESC');
    expect(sql).toContain('LIMIT 25');
    expect(sql).toContain('OFFSET 50');
  });

  it('applies the active selection predicate in the filtered count query', () => {
    const selection = Selection.crossfilter();
    selection.update(clausePoint('status', 'open', {source: {}}));

    const client = new ProfilerCountClient({
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
    const client = new ProfilerCountClient({
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

    const client = new ProfilerUnsupportedSummaryClient({
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

  it('marks only the safe profiler query clients as filter-stable', () => {
    const selection = Selection.crossfilter();

    const page = new ProfilerPageClient({
      columns: ['id'],
      onStateChange: () => {},
      pagination: {pageIndex: 0, pageSize: 10},
      selection,
      sorting: [],
      tableName: 'issues',
    });
    const filteredCount = new ProfilerCountClient({
      filterStable: true,
      onStateChange: () => {},
      selection,
      tableName: 'issues',
    });
    const totalCount = new ProfilerCountClient({
      onStateChange: () => {},
      tableName: 'issues',
    });
    const unsupported = new ProfilerUnsupportedSummaryClient({
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
