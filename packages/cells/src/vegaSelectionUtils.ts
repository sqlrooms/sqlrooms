import type {CrossFilterSelection} from './types';

/**
 * The standard Vega param name used for brush selections
 * in cross-filter-enabled charts.
 */
export const BRUSH_PARAM_NAME = 'brush';

/**
 * Build a SQL WHERE clause fragment from an array of sibling cross-filter
 * selections. Returns `null` when there are no active selections.
 *
 * Supports interval selections (BETWEEN) and point selections (IN).
 */
export function buildCrossFilterPredicate(
  selections: Array<CrossFilterSelection | null | undefined>,
): string | null {
  const clauses: string[] = [];

  for (const sel of selections) {
    if (!sel || sel.value == null) continue;

    const quotedField = `"${sel.field}"`;

    if (sel.type === 'interval') {
      const range = sel.value as [unknown, unknown];
      if (!Array.isArray(range) || range.length !== 2) continue;
      const [lo, hi] = range;
      if (lo == null || hi == null) continue;

      if (typeof lo === 'number' && typeof hi === 'number') {
        if (sel.fieldType === 'temporal') {
          clauses.push(
            `${quotedField} BETWEEN epoch_ms(${Math.round(lo)}) AND epoch_ms(${Math.round(hi)})`,
          );
        } else {
          clauses.push(`${quotedField} BETWEEN ${lo} AND ${hi}`);
        }
      } else if (typeof lo === 'string' && typeof hi === 'string') {
        const loEsc = lo.replace(/'/g, "''");
        const hiEsc = hi.replace(/'/g, "''");
        clauses.push(`${quotedField} BETWEEN '${loEsc}' AND '${hiEsc}'`);
      }
    } else if (sel.type === 'point') {
      const values = sel.value as unknown[];
      if (!Array.isArray(values) || values.length === 0) continue;

      const formatted = values.map((v) => {
        if (typeof v === 'number') return String(v);
        const s = String(v).replace(/'/g, "''");
        return `'${s}'`;
      });
      clauses.push(`${quotedField} IN (${formatted.join(', ')})`);
    }
  }

  return clauses.length > 0 ? clauses.join(' AND ') : null;
}
