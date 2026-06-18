import {makeQualifiedTableName} from '@sqlrooms/db';
import {
  getMosaicSqlTableReference,
  getMosaicTableReferenceString,
} from '../src/mosaicTableReference';

describe('mosaic table references', () => {
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
