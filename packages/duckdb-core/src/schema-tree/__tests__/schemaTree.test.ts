import {createDbSchemaTrees} from '../schemaTree';
import type {DataTable} from '../../types';

describe('schemaTree', () => {
  describe('createDbSchemaTrees', () => {
    describe('basic functionality', () => {
      it('should create a tree with databases, schemas, and tables', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: 'db1',
              schema: 'schema1',
              table: 'table1',
              toString: () => 'db1.schema1.table1',
            },
            isView: false,
            database: 'db1',
            schema: 'schema1',
            tableName: 'table1',
            columns: [
              {name: 'col1', type: 'INTEGER'},
              {name: 'col2', type: 'VARCHAR'},
            ],
          },
        ];

        const result = createDbSchemaTrees(tables);

        expect(result).toHaveLength(1);
        expect(result[0]?.object.type).toBe('database');
        expect(result[0]?.object.name).toBe('db1');
        expect(result[0]?.children).toHaveLength(1);
        expect(result[0]?.children?.[0]?.object.type).toBe('schema');
        expect(result[0]?.children?.[0]?.object.name).toBe('schema1');
        expect(result[0]?.children?.[0]?.children).toHaveLength(1);
        expect(result[0]?.children?.[0]?.children?.[0]?.object.type).toBe(
          'table',
        );
        expect(result[0]?.children?.[0]?.children?.[0]?.object.name).toBe(
          'table1',
        );
        expect(result[0]?.children?.[0]?.children?.[0]?.children).toHaveLength(
          2,
        );
      });
    });
  });
});
