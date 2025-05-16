import {getDuckDbTypeCategory} from './typeCategories';
import {DbSchemaNode, DataTable} from './types';

/**
 * Group tables by schema and create a tree of schemas, tables, and columns.
 * @param tables - The tables to group
 * @returns A map of schemas to their tables
 */
export function createDbSchemaTrees(tables: DataTable[]): DbSchemaNode[] {
  const schemaMap = new Map<string, DbSchemaNode[]>();

  for (const table of tables) {
    const schema = table.schema || 'main';
    const tableName = table.tableName;

    const columnNodes = table.columns.map((column) =>
      createColumnNode(schema, tableName, column.name, column.type),
    );

    const tableNode = createTableNode(schema, tableName, columnNodes);

    if (!schemaMap.has(schema)) {
      schemaMap.set(schema, []);
    }
    schemaMap.get(schema)?.push(tableNode);
  }

  return Array.from(schemaMap.entries()).map(([schema, tables]) =>
    createSchemaTreeNode(schema, tables),
  );
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
  schema: string,
  tableName: string,
  columnNodes: DbSchemaNode[],
): DbSchemaNode {
  return {
    key: `${schema}.${tableName}`,
    object: {
      type: 'table',
      schema,
      name: tableName,
    },
    isOpen: true,
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
    isOpen: true,
    children: tables,
  };
}
