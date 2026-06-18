import {
  parseQualifiedSqlIdentifier,
  type QualifiedTableName,
} from '@sqlrooms/db';
import {asTableRef, type TableRefNode} from '@uwdata/mosaic-sql';

export type MosaicTableReferenceInput = string | QualifiedTableName;

/**
 * Converts SQLRooms table identity into a Mosaic query table reference.
 *
 * SQLRooms keeps the DuckDB catalog/database in QualifiedTableName for stable
 * identity, but Mosaic queries execute against the active connector. Including
 * that catalog in generated SQL can target a catalog that is not attached in
 * the query connection. Mosaic also is not quote-aware when parsing table
 * strings, so return a TableRefNode for generated SQL.
 */
export function getMosaicSqlTableReference(
  tableName: MosaicTableReferenceInput,
): TableRefNode {
  return asTableRef(getMosaicTableReferenceParts(tableName))!;
}

/**
 * Returns the full SQLRooms table identity for React/store keys.
 */
export function getMosaicTableIdentity(
  tableName: MosaicTableReferenceInput,
): string {
  return typeof tableName === 'string' ? tableName.trim() : tableName.toString();
}

/**
 * Converts SQLRooms table identity into a schema/table SQL string for APIs that
 * only accept string table references.
 */
export function getMosaicTableReferenceString(
  tableName: MosaicTableReferenceInput,
): string {
  return getMosaicTableReferenceParts(tableName)
    .map(quoteMosaicTableReferencePart)
    .join('.');
}

function getMosaicTableReferenceParts(
  tableName: MosaicTableReferenceInput,
): string[] {
  if (typeof tableName !== 'string') {
    return tableName.toArray({includeDatabase: false});
  }

  const parsed = parseQualifiedSqlIdentifier(tableName);

  if (parsed?.table) {
    return [parsed.schema, parsed.table].filter(
      (part): part is string => Boolean(part),
    );
  }

  return [String(tableName).trim()];
}

function quoteMosaicTableReferencePart(part: string): string {
  return `"${part.replaceAll('"', '""')}"`;
}
