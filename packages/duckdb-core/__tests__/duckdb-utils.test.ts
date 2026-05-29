import {getTableNameFromQualified} from '../src/duckdb-utils';

describe('getTableNameFromQualified', () => {
  it('returns the bare table name unchanged', () => {
    expect(getTableNameFromQualified('users')).toBe('users');
  });

  it('returns the table from a schema.table identifier', () => {
    expect(getTableNameFromQualified('main.users')).toBe('users');
  });

  it('returns the table from a database.schema.table identifier', () => {
    expect(getTableNameFromQualified('mydb.public.users')).toBe('users');
  });

  it('strips quotes around each segment', () => {
    expect(getTableNameFromQualified('"mydb"."public"."users"')).toBe('users');
  });

  it('strips quotes from a single quoted identifier', () => {
    expect(getTableNameFromQualified('"users"')).toBe('users');
  });

  it('returns the last segment when given a non-main schema', () => {
    expect(getTableNameFromQualified('analytics.events')).toBe('events');
  });
});
