import {
  parseQualifiedSqlIdentifier,
  type QualifiedTableName,
} from '../duckdb-utils';
import type {DbSchemaNode, TableNodeObject} from './types';

export type ResolveTableReferenceResult<T> = {
  table?: T;
  ambiguousMatches?: T[];
};

type TableReferenceCandidate = {
  table: QualifiedTableName;
};

function isTableOrViewNode(object: unknown): boolean {
  const type = (object as {type?: unknown} | undefined)?.type;
  return type === 'table' || type === 'view';
}

function matchesQualifiedTableName<T extends TableReferenceCandidate>(
  candidate: T,
  tableName: Partial<QualifiedTableName>,
): boolean {
  return (
    candidate.table.table === tableName.table &&
    (!tableName.schema || candidate.table.schema === tableName.schema) &&
    (!tableName.database || candidate.table.database === tableName.database)
  );
}

/**
 * Resolves a table reference against an already-flat table catalog.
 *
 * Resolution prefers exact canonical table ids, then qualified SQL identifiers,
 * then unique bare table names. Ambiguous bare names are returned as matches
 * instead of silently selecting one table.
 *
 * @param tables - Flat catalog whose entries carry a QualifiedTableName.
 * @param tableReference - Table reference string or QualifiedTableName.
 * @returns Matching table, ambiguous matches, or an empty result.
 */
export function resolveTableReference<T extends TableReferenceCandidate>(
  tables: T[],
  tableReference: string | QualifiedTableName,
): ResolveTableReferenceResult<T> {
  if (typeof tableReference !== 'string') {
    return {
      table: tables.find(
        (candidate) => candidate.table.toString() === tableReference.toString(),
      ),
    };
  }

  const trimmedTableReference = tableReference.trim();
  const canonicalMatches = tables.filter(
    (candidate) => candidate.table.toString() === trimmedTableReference,
  );
  if (canonicalMatches.length === 1) return {table: canonicalMatches[0]};
  if (canonicalMatches.length > 1) {
    return {ambiguousMatches: canonicalMatches};
  }

  const parsedTableReference = parseQualifiedSqlIdentifier(
    trimmedTableReference,
  );
  if (
    parsedTableReference?.table &&
    (parsedTableReference.schema || parsedTableReference.database)
  ) {
    const qualifiedMatches = tables.filter((candidate) =>
      matchesQualifiedTableName(candidate, parsedTableReference),
    );
    if (qualifiedMatches.length === 1) return {table: qualifiedMatches[0]};
    if (qualifiedMatches.length > 1) {
      return {ambiguousMatches: qualifiedMatches};
    }
  }

  const bareMatches = tables.filter(
    (candidate) => candidate.table.table === trimmedTableReference,
  );
  if (bareMatches.length === 1) return {table: bareMatches[0]};
  if (bareMatches.length > 1) return {ambiguousMatches: bareMatches};

  return {};
}

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
    const dbType = dbNode?.object?.type;
    if ((dbType === undefined || dbType === 'database') && dbNode.children) {
      for (const schemaNode of dbNode.children) {
        const schemaType = schemaNode?.object?.type;
        if (
          (schemaType === undefined || schemaType === 'schema') &&
          schemaNode.children
        ) {
          for (const tableNode of schemaNode.children) {
            if (isTableOrViewNode(tableNode.object)) {
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
  const tables = getAllTablesFromSchemaTrees(schemaTrees);
  const resolved = resolveTableReference(tables, qualifiedName);

  if (resolved.ambiguousMatches) return undefined;
  if (resolved.table) return resolved.table;

  for (const table of tables) {
    const tableName = makeQualifiedTableName({
      database: table.table.database,
      schema: table.table.schema,
      table: table.table.table,
    }).toString();

    if (tableName === qualifiedName) {
      return table;
    }
  }

  return undefined;
}
