import {createDbSchemaTrees} from '../schemaTree';
import type {DataTable} from '../../types';

describe('schemaTree', () => {
  describe('createDbSchemaTrees', () => {
    describe('internal resource filtering', () => {
      it('should filter __sqlrooms_ephemeral database', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: '__sqlrooms_ephemeral',
              schema: 'main',
              table: 'temp_table',
              toString: () => '__sqlrooms_ephemeral.main.temp_table',
            },
            isView: false,
            database: '__sqlrooms_ephemeral',
            schema: 'main',
            tableName: 'temp_table',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'my_database',
              schema: 'public',
              table: 'users',
              toString: () => 'my_database.public.users',
            },
            isView: false,
            database: 'my_database',
            schema: 'public',
            tableName: 'users',
            columns: [
              {name: 'id', type: 'INTEGER'},
              {name: 'name', type: 'VARCHAR'},
            ],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should only contain my_database, not __sqlrooms_ephemeral
        expect(result).toHaveLength(1);
        expect(result[0]?.object.name).toBe('my_database');
      });

      it('should filter __sqlrooms_external schema', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: 'main',
              schema: '__sqlrooms_external',
              table: 'external_data',
              toString: () => 'main.__sqlrooms_external.external_data',
            },
            isView: false,
            database: 'main',
            schema: '__sqlrooms_external',
            tableName: 'external_data',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'main',
              schema: 'public',
              table: 'users',
              toString: () => 'main.public.users',
            },
            isView: false,
            database: 'main',
            schema: 'public',
            tableName: 'users',
            columns: [
              {name: 'id', type: 'INTEGER'},
              {name: 'name', type: 'VARCHAR'},
            ],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should contain main database with only public schema
        expect(result).toHaveLength(1);
        expect(result[0]?.object.name).toBe('main');
        expect(result[0]?.children).toHaveLength(1);
        expect(result[0]?.children?.[0]?.object.name).toBe('public');
      });

      it('should filter all __sqlrooms_* prefixed resources', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: '__sqlrooms_ephemeral',
              schema: 'main',
              table: 'temp1',
              toString: () => '__sqlrooms_ephemeral.main.temp1',
            },
            isView: false,
            database: '__sqlrooms_ephemeral',
            schema: 'main',
            tableName: 'temp1',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'main',
              schema: '__sqlrooms_stream_chunk_123',
              table: 'data',
              toString: () => 'main.__sqlrooms_stream_chunk_123.data',
            },
            isView: false,
            database: 'main',
            schema: '__sqlrooms_stream_chunk_123',
            tableName: 'data',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'main',
              schema: '__sqlrooms_upload_456',
              table: 'upload',
              toString: () => 'main.__sqlrooms_upload_456.upload',
            },
            isView: false,
            database: 'main',
            schema: '__sqlrooms_upload_456',
            tableName: 'upload',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should return empty array since all resources are internal
        expect(result).toHaveLength(0);
      });

      it('should allow user databases with __ prefix (but not __sqlrooms_)', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: '__my_database',
              schema: 'public',
              table: 'users',
              toString: () => '__my_database.public.users',
            },
            isView: false,
            database: '__my_database',
            schema: 'public',
            tableName: 'users',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'main',
              schema: '__my_schema',
              table: 'data',
              toString: () => 'main.__my_schema.data',
            },
            isView: false,
            database: 'main',
            schema: '__my_schema',
            tableName: 'data',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: '__sqlrooms_ephemeral',
              schema: 'main',
              table: 'temp',
              toString: () => '__sqlrooms_ephemeral.main.temp',
            },
            isView: false,
            database: '__sqlrooms_ephemeral',
            schema: 'main',
            tableName: 'temp',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should contain __my_database and main with __my_schema, but not __sqlrooms_ephemeral
        expect(result).toHaveLength(2);

        const myDatabase = result.find(
          (db) => db.object.name === '__my_database',
        );
        expect(myDatabase).toBeDefined();
        expect(myDatabase?.children).toHaveLength(1);
        expect(myDatabase?.children?.[0]?.object.name).toBe('public');

        const mainDatabase = result.find((db) => db.object.name === 'main');
        expect(mainDatabase).toBeDefined();
        expect(mainDatabase?.children).toHaveLength(1);
        expect(mainDatabase?.children?.[0]?.object.name).toBe('__my_schema');
      });

      it('should handle mixed tables (some internal, some user)', () => {
        const tables: DataTable[] = [
          {
            table: {
              database: 'main',
              schema: 'public',
              table: 'users',
              toString: () => 'main.public.users',
            },
            isView: false,
            database: 'main',
            schema: 'public',
            tableName: 'users',
            columns: [
              {name: 'id', type: 'INTEGER'},
              {name: 'name', type: 'VARCHAR'},
            ],
          },
          {
            table: {
              database: '__sqlrooms_ephemeral',
              schema: 'main',
              table: 'temp',
              toString: () => '__sqlrooms_ephemeral.main.temp',
            },
            isView: false,
            database: '__sqlrooms_ephemeral',
            schema: 'main',
            tableName: 'temp',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'main',
              schema: 'public',
              table: 'products',
              toString: () => 'main.public.products',
            },
            isView: false,
            database: 'main',
            schema: 'public',
            tableName: 'products',
            columns: [
              {name: 'id', type: 'INTEGER'},
              {name: 'name', type: 'VARCHAR'},
            ],
          },
          {
            table: {
              database: 'main',
              schema: '__sqlrooms_external',
              table: 'external',
              toString: () => 'main.__sqlrooms_external.external',
            },
            isView: false,
            database: 'main',
            schema: '__sqlrooms_external',
            tableName: 'external',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              database: 'analytics',
              schema: 'reports',
              table: 'sales',
              toString: () => 'analytics.reports.sales',
            },
            isView: false,
            database: 'analytics',
            schema: 'reports',
            tableName: 'sales',
            columns: [{name: 'amount', type: 'DECIMAL'}],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should contain main and analytics databases, excluding internal resources
        expect(result).toHaveLength(2);

        const mainDb = result.find((db) => db.object.name === 'main');
        expect(mainDb).toBeDefined();
        expect(mainDb?.children).toHaveLength(1); // Only public schema, not __sqlrooms_external
        expect(mainDb?.children?.[0]?.object.name).toBe('public');
        expect(mainDb?.children?.[0]?.children).toHaveLength(2); // users and products

        const analyticsDb = result.find((db) => db.object.name === 'analytics');
        expect(analyticsDb).toBeDefined();
        expect(analyticsDb?.children).toHaveLength(1);
        expect(analyticsDb?.children?.[0]?.object.name).toBe('reports');
      });

      it('should handle default database correctly', () => {
        const tables: DataTable[] = [
          {
            table: {
              schema: 'public',
              table: 'users',
              toString: () => 'public.users',
            },
            isView: false,
            schema: 'public',
            tableName: 'users',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
          {
            table: {
              schema: '__sqlrooms_external',
              table: 'external',
              toString: () => '__sqlrooms_external.external',
            },
            isView: false,
            schema: '__sqlrooms_external',
            tableName: 'external',
            columns: [{name: 'id', type: 'INTEGER'}],
          },
        ];

        const result = createDbSchemaTrees(tables);

        // Should contain default database with only public schema
        expect(result).toHaveLength(1);
        expect(result[0]?.object.name).toBe('default');
        expect(result[0]?.children).toHaveLength(1);
        expect(result[0]?.children?.[0]?.object.name).toBe('public');
      });
    });

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
