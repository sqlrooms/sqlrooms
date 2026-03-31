export type TableReference = {
  database?: string;
  schema?: string;
  table?: string;
};

/**
 * Parse a fully-qualified table reference into parts.
 * Example: "db"."schema"."table" -> {database: 'db', schema: 'schema', table: 'table'}
 */
export function parseTableReference(
  tableName: string,
): TableReference | undefined {
  // Remove quotes and split by dots
  const parts = tableName.replace(/"/g, '').split('.');

  if (parts.length === 3) {
    return {database: parts[0], schema: parts[1], table: parts[2]};
  } else if (parts.length === 2) {
    return {schema: parts[0], table: parts[1]};
  } else if (parts.length === 1) {
    return {table: parts[0]};
  }
  return undefined;
}
