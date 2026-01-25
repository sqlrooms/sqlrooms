import type {
  Cell,
  Edge,
  SqlCellData,
  SqlDependencyOptions,
  SqlRenderInput,
  SqlRunCallbacks,
  SqlRunResult,
} from './types';
import {getEffectiveResultName} from './types';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';

export function deriveEdgesFromSql(
  cellId: string,
  sql: string,
  allCells: Record<string, Cell>,
): Edge[] {
  const targetCell = allCells[cellId];
  if (!targetCell) return [];

  const deps = findSqlDependencies<Cell>({
    targetCell,
    cells: allCells,
    getSqlText: () => sql,
    getInputVarName: (cell) =>
      cell.type === 'input' ? cell.data.input.varName : undefined,
    getSqlResultName: (cid) => {
      const cell = allCells[cid];
      if (cell?.type === 'sql') {
        return getEffectiveResultName(
          cell.data as SqlCellData,
          convertToValidColumnOrTableName,
        );
      }
      return undefined;
    },
  });

  return deps.map((sourceId) => ({
    id: `${sourceId}-${cellId}`,
    source: sourceId,
    target: cellId,
  }));
}

export function renderSqlWithInputs(
  rawSql: string,
  inputs: SqlRenderInput[],
): string {
  const varMap: Record<string, string | number> = {};
  for (const {varName, value} of inputs) {
    varMap[varName] = value;
  }
  return (rawSql || '').replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_m: string, v: string) => {
      const val = varMap[v];
      return typeof val === 'number'
        ? String(val)
        : `'${String(val ?? '')?.replace(/'/g, "''")}'`;
    },
  );
}

export function findSqlDependencies<
  TCell extends {id: string; type: string},
>(opts: {
  targetCell: TCell;
  cells: Record<string, TCell>;
  getSqlText: (cell: TCell) => string | undefined;
  getInputVarName: (cell: TCell) => string | undefined;
  getSqlResultName: (cellId: string) => string | undefined;
  options?: SqlDependencyOptions;
}): string[] {
  const {
    targetCell,
    cells,
    getSqlText,
    getInputVarName,
    getSqlResultName,
    options,
  } = opts;
  const sql = getSqlText(targetCell) || '';
  const sqlLower = sql.toLowerCase();
  const deps: string[] = [];
  const inputTypes = options?.inputTypes ?? ['input'];
  const sqlTypes = options?.sqlTypes ?? ['sql'];

  for (const otherId in cells) {
    if (otherId === targetCell.id) continue;
    const other = cells[otherId];
    if (!other) continue;
    if (inputTypes.includes(other.type)) {
      const vn = getInputVarName(other);
      if (!vn) continue;
      if (sql.includes(`{{${vn}}}`) || sql.includes(`:${vn}`)) {
        deps.push(other.id);
      }
    } else if (sqlTypes.includes(other.type)) {
      const resultName = getSqlResultName(other.id);
      const title = (other as any).data?.title;
      // Match on title (case-insensitive)
      const titleMatch = title && sqlLower.includes(title.toLowerCase());
      // Match on effective result name (case-insensitive)
      const resultMatch =
        resultName && sqlLower.includes(resultName.toLowerCase());
      if (titleMatch || resultMatch) deps.push(other.id);
    }
  }
  return Array.from(new Set(deps));
}

export async function runSqlWithCallbacks(
  run: () => Promise<SqlRunResult>,
  callbacks: SqlRunCallbacks = {},
) {
  callbacks.onStart?.();
  try {
    const res = await run();
    callbacks.onSuccess?.(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    callbacks.onError?.(message);
  } finally {
    callbacks.onFinally?.();
  }
}

/**
 * Recursively extract table names from a parsed SQL AST.
 */
function extractTablesFromAst(statements: unknown[]): Set<string> {
  const tables = new Set<string>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    // DuckDB AST uses table_name for table references
    if (typeof obj.table_name === 'string') {
      tables.add(obj.table_name.toLowerCase());
    }

    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (value && typeof value === 'object') {
        walk(value);
      }
    }
  };

  for (const stmt of statements) {
    const stmtObj = stmt as Record<string, unknown>;
    if (stmtObj.node) {
      walk(stmtObj.node);
    } else {
      walk(stmt);
    }
  }

  return tables;
}

/**
 * Find SQL cell dependencies using AST-based parsing.
 * This provides more accurate detection than text-based matching.
 */
export async function findSqlDependenciesFromAst(opts: {
  sql: string;
  cells: Record<string, Cell>;
  sqlSelectToJson: (sql: string) => Promise<{
    error: boolean;
    statements?: unknown[];
  }>;
}): Promise<string[]> {
  const {sql, cells, sqlSelectToJson} = opts;

  try {
    const parsed = await sqlSelectToJson(sql);
    if (parsed.error || !parsed.statements) {
      return []; // Fall back to empty deps on parse error
    }

    const referencedTables = extractTablesFromAst(parsed.statements);
    const deps: string[] = [];

    for (const [id, cell] of Object.entries(cells)) {
      if (cell.type === 'sql') {
        const cellData = cell.data as SqlCellData;
        const title = cellData.title?.toLowerCase();
        const effectiveName = getEffectiveResultName(
          cellData,
          convertToValidColumnOrTableName,
        ).toLowerCase();
        // Match on either title or effective result name
        if (
          (title && referencedTables.has(title)) ||
          referencedTables.has(effectiveName)
        ) {
          deps.push(id);
        }
      }
    }

    return deps;
  } catch {
    return [];
  }
}
