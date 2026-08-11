/**
 * DuckDB keeps the original column from `SELECT *` and renames a colliding
 * `ST_AsWKB(...) AS col` to `col_1` (or leaves the first `col` as native
 * GEOMETRY). The map then binds the undecodable internal blob and renders
 * nothing. Prefer `SELECT * EXCLUDE (col), ST_AsWKB(...) AS col`.
 *
 * Only rewrites when `ST_AsWKB(...) AS col` appears in the **same** SELECT list
 * as `*` (e.g. `SELECT *, ST_AsWKB(geom) AS geom FROM ...`). Does **not** touch
 * wrappers like `SELECT * FROM (… ST_AsWKB(...) AS geom …)` used by row sampling.
 */

function findTopLevelFromIndex(sql: string, selectStarEnd: number): number {
  let depth = 0;
  for (let i = selectStarEnd; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      if (depth === 0) return -1;
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (
      (sql[i] === 'F' || sql[i] === 'f') &&
      /^FROM\b/i.test(sql.slice(i)) &&
      (i === 0 || !/[A-Za-z0-9_]/.test(sql[i - 1]!))
    ) {
      return i;
    }
  }
  return -1;
}

function collectStAsWkbAliasesInSelectList(selectList: string): string[] {
  const excludes: string[] = [];
  const seen = new Set<string>();
  const re = /\bST_AsWKB\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(selectList)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < selectList.length && depth > 0) {
      const ch = selectList[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    if (depth !== 0) continue;
    const asMatch = selectList
      .slice(i)
      .match(/^\s+AS\s+("([^"]+)"|([A-Za-z_][\w$]*))/i);
    if (!asMatch) continue;
    const col = asMatch[2] ?? asMatch[3];
    if (!col || seen.has(col)) continue;
    seen.add(col);
    excludes.push(
      /^[A-Za-z_][\w$]*$/.test(col) ? col : `"${col.replace(/"/g, '""')}"`,
    );
  }
  return excludes;
}

/**
 * True when a SELECT list mixes `*` with `ST_AsWKB(...) AS col` without
 * EXCLUDE/REPLACE (same-list name collision).
 */
export function hasSelectStarAsWkbCollision(sql: string): boolean {
  const re = /\bSELECT\s+\*/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const afterStar = sql.slice(match.index + match[0].length);
    if (/^\s*(EXCLUDE|REPLACE)\b/i.test(afterStar)) continue;
    // `SELECT * FROM ...` has no sibling projections — not a collision.
    if (!/^\s*,/.test(afterStar)) continue;

    const fromAt = findTopLevelFromIndex(sql, match.index + match[0].length);
    if (fromAt < 0) continue;
    const selectList = sql.slice(match.index, fromAt);
    if (collectStAsWkbAliasesInSelectList(selectList).length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Rewrites same-list `SELECT *, ST_AsWKB(...) AS col` to
 * `SELECT * EXCLUDE (col), ST_AsWKB(...) AS col`. Returns null when unchanged.
 */
export function rewriteSelectStarAsWkbCollisions(sql: string): string | null {
  if (!hasSelectStarAsWkbCollision(sql)) return null;

  const re = /\bSELECT\s+\*/gi;
  let match: RegExpExecArray | null;
  let result = sql;
  let offset = 0;

  while ((match = re.exec(sql)) !== null) {
    const absIndex = match.index;
    const afterStar = sql.slice(absIndex + match[0].length);
    if (/^\s*(EXCLUDE|REPLACE)\b/i.test(afterStar)) continue;
    if (!/^\s*,/.test(afterStar)) continue;

    const fromAt = findTopLevelFromIndex(sql, absIndex + match[0].length);
    if (fromAt < 0) continue;
    const selectList = sql.slice(absIndex, fromAt);
    const excludes = collectStAsWkbAliasesInSelectList(selectList);
    if (excludes.length === 0) continue;

    const replacement = `SELECT * EXCLUDE (${excludes.join(', ')})`;
    const start = absIndex + offset;
    const end = start + match[0].length;
    result = result.slice(0, start) + replacement + result.slice(end);
    offset += replacement.length - match[0].length;
  }

  return result === sql ? null : result;
}
