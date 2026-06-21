import {QualifiedTableName} from '@sqlrooms/db';
import {
  Cell,
  CellDependencies,
  CellRegistry,
  CellsRootState,
  CellsSliceConfig,
  SqlCell,
  SqlSelectToJsonFn,
  CellArtifactRuntime,
} from './types';
import {getArtifactSchemaName} from './utils';

/**
 * Normalizes the result of `findDependencies` to a `CellDependencies` object.
 * Accepts either the legacy `string[]` (cell IDs only) or the new `CellDependencies` shape.
 */
export function normalizeCellDependencies(
  result: string[] | CellDependencies,
): CellDependencies {
  if (Array.isArray(result)) {
    return {cellIds: result};
  }
  return result;
}

/**
 * Helper to resolve dependencies using the registry's async AST-based resolver.
 */
export async function resolveDependencies(
  cell: Cell,
  cells: Record<string, Cell>,
  artifactId: string,
  registry: CellRegistry,
  sqlSelectToJson: SqlSelectToJsonFn,
): Promise<CellDependencies> {
  const item = registry[cell.type];
  if (!item) return {cellIds: []};
  const raw = await item.findDependencies({
    cell,
    cells,
    artifactId,
    sqlSelectToJson,
  });
  return normalizeCellDependencies(raw);
}

/**
 * Finds the artifact ID that contains the given cell ID.
 */
export function findArtifactIdForCell(
  state: Pick<CellsRootState, 'cells'>,
  cellId: string,
): string | undefined {
  for (const [artifactId, artifact] of Object.entries(
    state.cells.config.artifacts,
  )) {
    if (artifact.cellIds.includes(cellId)) {
      return artifactId;
    }
  }
  return undefined;
}

/**
 * Required accessor for SQL AST parser used in dependency derivation.
 */
export function getRequiredSqlSelectToJson(
  state: CellsRootState,
): SqlSelectToJsonFn {
  const parser = state.db?.sqlSelectToJson;
  if (!parser) {
    throw new Error(
      'cells dependency derivation requires db.sqlSelectToJson. Ensure the DuckDB slice is mounted and initialized before running cell dependency operations.',
    );
  }
  return parser;
}

/**
 * Normalizes artifact runtime entries in a partial cells config.
 *
 * This enforces internal invariants before the config is applied:
 * - `artifacts` always has stable ids that match the record keys.
 */
export function normalizeCellsConfigStructure(
  config: Partial<CellsSliceConfig>,
): Pick<CellsSliceConfig, 'artifacts'> {
  const artifacts = Object.fromEntries(
    Object.entries(config.artifacts ?? {}).map(([artifactId, artifact]) => [
      artifactId,
      {
        ...artifact,
        id: artifactId,
        cellIds: artifact.cellIds ?? [],
        edges: artifact.edges ?? [],
      },
    ]),
  ) as Record<string, CellArtifactRuntime>;

  return {artifacts};
}

export {getUnqualifiedSqlIdentifier} from '@sqlrooms/duckdb';

/**
 * Resolves the schema name for an artifact runtime, falling back to a stable id-based name.
 */
export function resolveArtifactSchemaName(
  artifact: Pick<CellArtifactRuntime, 'id' | 'schemaName'>,
) {
  return artifact.schemaName || getArtifactSchemaName(artifact.id);
}

const DATA_SOURCE_CELL_PREFIX = 'cell:';
const DATA_SOURCE_TABLE_PREFIX = 'table:';

export function toDataSourceCell(cell: SqlCell | string): string {
  const id = typeof cell === 'string' ? cell : cell.id;

  return `${DATA_SOURCE_CELL_PREFIX}${id}`;
}

export function toDataSourceTable(table: QualifiedTableName | string): string {
  if (typeof table === 'string') {
    return `${DATA_SOURCE_TABLE_PREFIX}${table}`;
  }

  // Escape each identifier segment: double any internal quotes, then wrap in quotes
  const escapeIdentifier = (id: string) => `"${id.replace(/"/g, '""')}"`;

  const qualifiedName = [
    table.schema ? escapeIdentifier(table.schema) : null,
    escapeIdentifier(table.table),
  ]
    .filter(Boolean)
    .join('.');

  return `${DATA_SOURCE_TABLE_PREFIX}${qualifiedName}`;
}

export function isDataSourceCell(value: string): boolean {
  return value.startsWith(DATA_SOURCE_CELL_PREFIX);
}

export function isDataSourceTable(value: string): boolean {
  return value.startsWith(DATA_SOURCE_TABLE_PREFIX);
}

export function fromDataSourceCell(value: string): string | undefined {
  if (isDataSourceCell(value)) {
    return value.slice(DATA_SOURCE_CELL_PREFIX.length);
  }
  return undefined;
}

export function fromDataSourceTable(value: string): string | undefined {
  if (isDataSourceTable(value)) {
    return value.slice(DATA_SOURCE_TABLE_PREFIX.length);
  }
  return undefined;
}
