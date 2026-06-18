import {makeQualifiedTableName} from '@sqlrooms/db';
import {
  getMosaicSqlTableReference,
  getMosaicTableIdentity,
  getMosaicTableReferenceString,
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

    expect(getMosaicTableIdentity(first)).toBe('"db1"."main"."orders"');
    expect(getMosaicTableIdentity(second)).toBe('"db2"."main"."orders"');
  });

  it('drops the catalog and keeps schema/table for Mosaic string APIs', () => {
    const table = makeQualifiedTableName({
      database: 'sqlrooms-cli',
      schema: 'main',
      table: 'earthquakes',
    });

    expect(getMosaicTableReferenceString(table)).toBe('main.earthquakes');
  });

  it('parses quoted qualified strings before building Mosaic SQL refs', () => {
    const tableRef = getMosaicSqlTableReference(
      '"sqlrooms-cli"."main"."earthquakes"',
    );

    expect(tableRef.toString()).toContain('"main"."earthquakes"');
    expect(tableRef.toString()).not.toContain('sqlrooms-cli');
  });
});
