import type {DataTable} from '../types';
import {getDuckDbTypeCategory} from './typeCategories';
import type {DbSchemaNode, QualifiedSchema} from './types';

/**
 * Build a tree of databases → schemas → tables → columns from the grouped schema list.
 * Empty schemas (`tables: []`) are preserved as leaf-less schema nodes.
 * @param schemas - Schemas grouped by database, each carrying its tables (may be empty)
 * @returns An array of database nodes
 */
export function createDbSchemaTrees(
  schemas: QualifiedSchema[],
): DbSchemaNode[] {
  const databaseMap = new Map<string, Map<string, DbSchemaNode[]>>();

  for (const {database, schema, tables} of schemas) {
    const db = database || 'default';
    if (!databaseMap.has(db)) {
      databaseMap.set(db, new Map<string, DbSchemaNode[]>());
    }
    const schemaMap = databaseMap.get(db)!;
    if (!schemaMap.has(schema)) {
      schemaMap.set(schema, []);
    }
    const schemaTables = schemaMap.get(schema)!;
    for (const table of tables) {
      const columnNodes = table.columns.map((column) =>
        createColumnNode(schema, table.tableName, column.name, column.type),
      );
      schemaTables.push(createTableNode(table, columnNodes));
    }
  }

  return Array.from(databaseMap.entries()).map(([database, schemaMap]) => {
    const schemaNodes = Array.from(schemaMap.entries()).map(
      ([schema, tables]) => createSchemaTreeNode(schema, tables),
    );
    return createDatabaseTreeNode(database, schemaNodes);
  });
}

function createColumnNode(
  schema: string,
  tableName: string,
  columnName: string,
  columnType: string,
): DbSchemaNode {
  return {
    key: `${schema}.${tableName}.${columnName}`,
    object: {
      type: 'column',
      name: columnName,
      columnType,
      columnTypeCategory: getDuckDbTypeCategory(columnType),
    },
  };
}

function createTableNode(
  table: DataTable,
  columnNodes: DbSchemaNode[],
): DbSchemaNode {
  return {
    key: `${table.schema}.${table.tableName}`,
    object: {
      type: 'table',
      ...table,
      name: table.tableName,
    },
    isInitialOpen: false,
    children: columnNodes,
  };
}

function createSchemaTreeNode(
  schema: string,
  tables: DbSchemaNode[],
): DbSchemaNode {
  return {
    key: schema,
    object: {
      type: 'schema',
      name: schema,
    },
    isInitialOpen: true,
    children: tables,
  };
}

function createDatabaseTreeNode(
  database: string,
  schemas: DbSchemaNode[],
): DbSchemaNode {
  return {
    key: database,
    object: {
      type: 'database',
      name: database,
    },
    isInitialOpen: true,
    children: schemas,
  };
}
