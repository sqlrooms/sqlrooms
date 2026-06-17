import type {DbSchemaNode, TableNodeObject} from './types';

/**
 * Flattens a schema tree and extracts all table nodes.
 * @param schemaTrees - Array of database schema tree nodes
 * @returns Array of all table objects found in the tree
 */
export function getAllTablesFromSchemaTrees(
  schemaTrees: DbSchemaNode[] | undefined,
): TableNodeObject[] {
  const tables: TableNodeObject[] = [];

  if (!schemaTrees) return tables;

  for (const dbNode of schemaTrees) {
    if (dbNode.object.type === 'database' && dbNode.children) {
      for (const schemaNode of dbNode.children) {
        if (schemaNode.object.type === 'schema' && schemaNode.children) {
          for (const tableNode of schemaNode.children) {
            if (tableNode.object.type === 'table') {
              tables.push(tableNode.object as TableNodeObject);
            }
          }
        }
      }
    }
  }

  return tables;
}

/**
 * Finds a specific table by its qualified name in the schema tree.
 * @param schemaTrees - Array of database schema tree nodes
 * @param qualifiedName - Qualified table name (e.g., "database.schema.table")
 * @param makeQualifiedTableName - Function to create qualified table names for comparison
 * @returns The table object if found, undefined otherwise
 */
export function findTableInSchemaTrees(
  schemaTrees: DbSchemaNode[] | undefined,
  qualifiedName: string,
  makeQualifiedTableName: (parts: {
    database?: string;
    schema?: string;
    table: string;
  }) => {toString: () => string},
): TableNodeObject | undefined {
  if (!schemaTrees) return undefined;

  for (const dbNode of schemaTrees) {
    if (dbNode.object.type === 'database' && dbNode.children) {
      for (const schemaNode of dbNode.children) {
        if (schemaNode.object.type === 'schema' && schemaNode.children) {
          for (const tableNode of schemaNode.children) {
            if (tableNode.object.type === 'table') {
              const tableObj = tableNode.object as TableNodeObject;
              const tableName = makeQualifiedTableName({
                database: tableObj.table.database,
                schema: tableObj.table.schema,
                table: tableObj.table.table,
              }).toString();

              if (tableName === qualifiedName) {
                return tableObj;
              }
            }
          }
        }
      }
    }
  }

  return undefined;
}
