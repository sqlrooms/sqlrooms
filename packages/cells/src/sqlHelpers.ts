import type {
  Cell,
  Edge,
  SqlDependencyOptions,
  SqlRenderInput,
  SqlRunCallbacks,
  SqlRunResult,
} from './types';

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
      return cell?.type === 'sql' ? cell.data.title : undefined;
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
      const nameMatch =
        (other as any).data?.title && sql.includes((other as any).data.title);
      const resultMatch = resultName && sql.includes(resultName);
      if (nameMatch || resultMatch) deps.push(other.id);
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
