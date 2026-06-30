import {getTableIdentity, makeQualifiedTableName} from '@sqlrooms/db';
import {
  getMosaicRawSqlTableReference,
  getMosaicSqlTableReference,
  getMosaicVgPlotTableReference,
  resolveMosaicTableReference,
} from '../src/mosaicTableReference';

describe('mosaic table references', () => {
  it('keeps the catalog in SQLRooms identity strings', () => {
    const first = makeQualifiedTableName({
      database: 'db1',
      schema: 'main',
      table: 'orders',
    });
    const second = makeQualifiedTableName({
      database: 'db2',
      schema: 'main',
      table: 'orders',
    });

    expect(getTableIdentity(first)).toBe('"db1"."main"."orders"');
    expect(getTableIdentity(second)).toBe('"db2"."main"."orders"');
  });

  it('drops the catalog and quotes schema/table for vgplot string refs', () => {
    const table = makeQualifiedTableName({
      database: 'sqlrooms-cli',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(getMosaicVgPlotTableReference(table)).toBe('"main"."earthquakes"');
  });

  it('preserves dotted and quoted identifier boundaries', () => {
    const table = makeQualifiedTableName({
      database: 'db',
      schema: 'ma.in',
      table: 'events"2026',
    });

    expect(getMosaicVgPlotTableReference(table)).toBe('"ma.in"."events""2026"');
    expect(getMosaicSqlTableReference(table).toString()).toContain(
      '"ma.in"."events""2026"',
    );
  });

  it('parses quoted qualified strings before building Mosaic SQL refs', () => {
    const tableRef = getMosaicSqlTableReference(
      '"sqlrooms-cli"."main"."earthquakes"',
    );

    expect(tableRef.toString()).toContain('"main"."earthquakes"');
    expect(tableRef.toString()).not.toContain('sqlrooms-cli');
  });

  it('keeps memory catalog identities out of Mosaic execution references', () => {
    const identity = '"memory"."main"."events"';

    expect(getMosaicSqlTableReference(identity).toString()).toContain(
      '"main"."events"',
    );
    expect(getMosaicSqlTableReference(identity).toString()).not.toContain(
      'memory',
    );
    expect(getMosaicVgPlotTableReference(identity)).toBe('"main"."events"');
    expect(getMosaicRawSqlTableReference(identity)).toBe('"main"."events"');
  });

  it('preserves dotted table identifiers when building raw SQL refs', () => {
    expect(getMosaicRawSqlTableReference('"main"."events.with.dot"')).toBe(
      '"main"."events.with.dot"',
    );
    expect(
      getMosaicSqlTableReference('"main"."events.with.dot"').toString(),
    ).toContain('"main"."events.with.dot"');
  });

  it('resolves legacy bare table names only when unambiguous', () => {
    const mainEvents = {
      table: makeQualifiedTableName({
        database: 'memory',
        schema: 'main',
        table: 'events',
      }),
    };
    const analyticsEvents = {
      table: makeQualifiedTableName({
        database: 'memory',
        schema: 'analytics',
        table: 'events',
      }),
    };
    const orders = {
      table: makeQualifiedTableName({
        database: 'memory',
        schema: 'main',
        table: 'orders',
      }),
    };

    expect(
      resolveMosaicTableReference([mainEvents, orders], 'events').table,
    ).toBe(mainEvents);
    expect(
      resolveMosaicTableReference(
        [mainEvents, analyticsEvents],
        '"memory"."main"."events"',
      ).table,
    ).toBe(mainEvents);
    expect(
      resolveMosaicTableReference([mainEvents, analyticsEvents], 'events')
        .ambiguousMatches,
    ).toEqual([mainEvents, analyticsEvents]);
  });
});
