/**
 * Detects DuckDB `SELECT *, ST_AsWKB(...) AS col` same-list collisions.
 *
 * DuckDB keeps the original column from `SELECT *` and renames a colliding
 * `ST_AsWKB(...) AS col` to `col_1` (or leaves the first `col` as native
 * GEOMETRY). The map then binds the undecodable internal blob and renders
 * nothing.
 *
 * Detection only — do not rewrite authored SQL. Agents / authors should use
 * `SELECT * EXCLUDE (col), ST_AsWKB(...) AS col`, or omit the transform when
 * WKB already exists. Does **not** flag wrappers like
 * `SELECT * FROM (… ST_AsWKB(...) AS geom …)` used by row sampling.
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

/**
 * True when a SELECT list mixes `*` with `ST_AsWKB(...) AS col` that reuses a
 * name from inside the ST_AsWKB expression (e.g. `ST_AsWKB(geom) AS geom`),
 * without EXCLUDE/REPLACE.
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

    const asWkbRe = /\bST_AsWKB\s*\(/gi;
    let asWkb: RegExpExecArray | null;
    while ((asWkb = asWkbRe.exec(selectList)) !== null) {
      let depth = 1;
      let i = asWkb.index + asWkb[0].length;
      const exprStart = i;
      while (i < selectList.length && depth > 0) {
        const ch = selectList[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
        i += 1;
      }
      if (depth !== 0) continue;
      const exprBody = selectList.slice(exprStart, i - 1);
      const asMatch = selectList
        .slice(i)
        .match(/^\s+AS\s+("([^"]+)"|([A-Za-z_][\w$]*))/i);
      if (!asMatch) continue;
      const col = asMatch[2] ?? asMatch[3];
      if (!col) continue;
      // Only flag when the alias reuses a name from inside ST_AsWKB(...) —
      // that is the DuckDB SELECT * collision (`ST_AsWKB(geom) AS geom`).
      // New aliases like `__sqlrooms_geom` from ST_Point are fine with SELECT *.
      const aliasRe = new RegExp(
        `(^|[^A-Za-z0-9_])${col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`,
      );
      if (aliasRe.test(exprBody)) return true;
    }
  }
  return false;
}
