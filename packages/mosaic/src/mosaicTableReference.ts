import {
  parseQualifiedSqlIdentifier,
  escapeId,
  type RawSqlTableReference,
  type QualifiedTableName,
  resolveTableReference,
  type ResolveTableReferenceResult,
} from '@sqlrooms/db';
import {asTableRef, type TableRefNode} from '@uwdata/mosaic-sql';

declare const vgPlotTableReferenceBrand: unique symbol;

/**
 * Mosaic SQL AST table reference used by Mosaic query-builder APIs.
 *
 * This is a structured `TableRefNode`, not a persisted identity string or a raw
 * SQL fragment.
 */
export type MosaicSqlTableReference = TableRefNode;

/**
 * Serializable vgplot `data.from` value that must be normalized through
 * SQLRooms' vgplot renderer before it reaches Mosaic execution.
 */
export type VgPlotTableReference = string & {
  readonly [vgPlotTableReferenceBrand]: 'VgPlotTableReference';
};

/**
 * SQLRooms table reference input accepted at Mosaic boundaries.
 *
 * Strings represent persisted identities or user-provided references;
 * QualifiedTableName values carry structured SQLRooms table identity.
 */
export type MosaicTableReferenceInput = string | QualifiedTableName;

/**
 * Runtime object carrying a structured SQLRooms table identity.
 *
 * Use this shape for catalog candidates so persisted identity strings stay
 * distinct from resolved runtime table objects.
 */
export type MosaicTableReferenceCandidate = {table: QualifiedTableName};

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
): MosaicSqlTableReference {
  return asTableRef(getMosaicTableReferenceParts(tableName))!;
}

/**
 * Converts SQLRooms table identity into a serializable vgplot `data.from`
 * reference.
 *
 * SQLRooms normalizes this string into a Mosaic TableRefNode before handing the
 * spec to Mosaic at runtime. Keeping this string SQL-quoted preserves dotted
 * identifier boundaries through JSON serialization.
 */
export function getMosaicVgPlotTableReference(
  tableName: MosaicTableReferenceInput,
): VgPlotTableReference {
  return getMosaicRawSqlTableReference(
    tableName,
  ) as string as VgPlotTableReference;
}

/**
 * Converts SQLRooms table identity into a schema/table SQL fragment for raw SQL
 * builders. The active Mosaic connector owns the catalog, so the database part
 * is intentionally omitted.
 */
export function getMosaicRawSqlTableReference(
  tableName: MosaicTableReferenceInput,
): RawSqlTableReference {
  return getMosaicTableReferenceParts(tableName)
    .map(escapeId)
    .join('.') as RawSqlTableReference;
}

/**
 * Resolves a persisted dashboard table identity against the current SQLRooms
 * table catalog. Canonical identities and qualified SQL identifiers are
 * preferred; legacy bare names resolve only when unambiguous.
 */
export function resolveMosaicTableReference<
  T extends MosaicTableReferenceCandidate,
>(
  tables: T[],
  tableName: MosaicTableReferenceInput | undefined,
): ResolveTableReferenceResult<T> {
  if (!tableName) {
    return {};
  }
  return resolveTableReference(tables, tableName);
}

/**
 * Returns raw identifier parts for Mosaic-owned table-reference conversions.
 *
 * The database/catalog is omitted because Mosaic queries execute in the active
 * connector context.
 */
function getMosaicTableReferenceParts(
  tableName: MosaicTableReferenceInput,
): string[] {
  if (typeof tableName !== 'string') {
    return tableName.toArray({includeDatabase: false});
  }

  const parsed = parseQualifiedSqlIdentifier(tableName);

  if (parsed?.table) {
    return [parsed.schema, parsed.table].filter((part): part is string =>
      Boolean(part),
    );
  }

  return [String(tableName).trim()];
}
