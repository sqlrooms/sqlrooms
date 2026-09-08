import {describe, expect, test} from 'vitest';
import {
  BARE_TABLE_NAME_PATTERN,
  areWorkspaceTableNamesEqual,
  findWorkspaceTableName,
} from './tableName';

describe('workspace table names', () => {
  test.each(['orders', '_orders', 'Orders_2026'])(
    'accepts the bare identifier %s',
    (tableName) => {
      expect(BARE_TABLE_NAME_PATTERN.test(tableName)).toBe(true);
    },
  );

  test.each(['1orders', 'order items', 'safe; DROP TABLE other; --'])(
    'rejects the unsafe identifier %s',
    (tableName) => {
      expect(BARE_TABLE_NAME_PATTERN.test(tableName)).toBe(false);
    },
  );

  test('matches table names case-insensitively while preserving stored casing', () => {
    expect(areWorkspaceTableNamesEqual('Orders', 'orders')).toBe(true);
    expect(findWorkspaceTableName(['Customers', 'Orders'], 'orders')).toBe(
      'Orders',
    );
  });
});
