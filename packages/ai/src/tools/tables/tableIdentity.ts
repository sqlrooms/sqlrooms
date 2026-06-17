import type {DataTable, QualifiedTableName} from '@sqlrooms/duckdb';

export type TableIdentitySummary = {
  /**
   * Fully quoted SQL identifier from QualifiedTableName.toString(), used at
   * string-only tool boundaries.
   */
  tableId: string;
  /**
   * @deprecated Use tableId for string-only tools.
   */
  qualifiedName: string;
  database?: string;
  schema?: string;
  tableName: string;
  isView: boolean;
  columnCount: number;
  rowCount?: number;
};

export function getCanonicalTableId(table: DataTable): string {
  return table.table.toString();
}

export function getAllTablesFromSchemaTrees(schemaTrees: unknown): DataTable[] {
  const tables: DataTable[] = [];
  if (!Array.isArray(schemaTrees)) return tables;

  for (const dbNode of schemaTrees) {
    for (const schemaNode of dbNode?.children ?? []) {
      for (const tableNode of schemaNode?.children ?? []) {
        if (tableNode?.object?.type === 'table') {
          tables.push(tableNode.object as DataTable);
        }
      }
    }
  }
  return tables;
}

export function createTableIdentitySummary(
  table: DataTable,
): TableIdentitySummary {
  const tableId = getCanonicalTableId(table);
  return {
    tableId,
    qualifiedName: tableId,
    database: table.table.database,
    schema: table.table.schema,
    tableName: table.table.table,
    isView: table.isView,
    columnCount: table.columns.length,
    rowCount: table.rowCount,
  };
}

function unquoteSqlIdentifierSegment(identifier: string): string {
  const segment = identifier.trim();
  if (segment.startsWith('"') && segment.endsWith('"') && segment.length >= 2) {
    return segment.slice(1, -1).split('""').join('"');
  }
  return segment;
}

function parseQualifiedSqlIdentifier(
  qualifiedName: string | undefined,
): Partial<QualifiedTableName> | undefined {
  if (!qualifiedName) return undefined;
  const input = qualifiedName.trim();
  if (!input) return undefined;

  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (inQuotes && input[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === '.' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }
  parts.push(current);

  if (inQuotes || parts.length === 0 || parts.length > 3) return undefined;

  const identifiers = parts.map(unquoteSqlIdentifierSegment);
  if (identifiers.some((part) => part.length === 0)) return undefined;

  if (identifiers.length === 3) {
    return {
      database: identifiers[0],
      schema: identifiers[1],
      table: identifiers[2],
    };
  }
  if (identifiers.length === 2) {
    return {schema: identifiers[0], table: identifiers[1]};
  }
  return {table: identifiers[0]};
}

function matchesQualifiedTableName(
  table: DataTable,
  tableName: Partial<QualifiedTableName>,
): boolean {
  return (
    table.table.table === tableName.table &&
    (!tableName.schema || table.table.schema === tableName.schema) &&
    (!tableName.database || table.table.database === tableName.database)
  );
}

export function resolveTableFromCatalog(
  tables: DataTable[],
  tableId: string,
): {table?: DataTable; ambiguousMatches?: DataTable[]} {
  const trimmedTableId = tableId.trim();

  const canonicalMatches = tables.filter(
    (table) => getCanonicalTableId(table) === trimmedTableId,
  );
  if (canonicalMatches.length === 1) return {table: canonicalMatches[0]};
  if (canonicalMatches.length > 1) {
    return {ambiguousMatches: canonicalMatches};
  }

  const parsedTableId = parseQualifiedSqlIdentifier(trimmedTableId);
  if (
    parsedTableId?.table &&
    (parsedTableId.schema || parsedTableId.database)
  ) {
    const qualifiedMatches = tables.filter((table) =>
      matchesQualifiedTableName(table, parsedTableId),
    );
    if (qualifiedMatches.length === 1) return {table: qualifiedMatches[0]};
    if (qualifiedMatches.length > 1) {
      return {ambiguousMatches: qualifiedMatches};
    }
  }

  const bareMatches = tables.filter(
    (table) => table.table.table === trimmedTableId,
  );
  if (bareMatches.length === 1) return {table: bareMatches[0]};
  if (bareMatches.length > 1) return {ambiguousMatches: bareMatches};

  return {};
}

export function formatAmbiguousTableMessage(
  tableId: string,
  tables: DataTable[],
) {
  return `Table "${tableId}" is ambiguous. Matching tableIds: ${tables
    .map(getCanonicalTableId)
    .join(', ')}.`;
}
