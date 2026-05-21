/**
 * Split a (possibly DuckDB-quoted) qualified identifier on `.` separators,
 * preserving dots that appear inside quoted segments. Doubled quotes (`""`)
 * inside a quoted segment are kept as-is so {@link normalizeIdentifierPart}
 * can collapse them.
 */
export function splitQualifiedIdentifier(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (char === '"') {
      current += char;
      if (inQuotes && value[i + 1] === '"') {
        current += value[i + 1];
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '.' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts;
}

/**
 * Strip surrounding double-quotes from a single identifier part and
 * collapse any escaped `""` back to a literal `"`.
 */
export function normalizeIdentifierPart(part: string): string {
  const trimmed = part.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/**
 * Compute a human-friendly label for a Kepler dataset given a
 * (possibly quoted, possibly fully-qualified) DuckDB table name.
 *
 * Database name is never shown. Schema is shown unless it is `main`.
 *
 * Rules:
 * - 1 part (`table`): use as-is.
 * - 2 parts (`schema.table`): `schema table`, or `table` if schema is `main`.
 * - 3 parts (`database.schema.table`): database dropped → `schema table`,
 *   or `table` if schema is `main`.
 *
 * Schema and table are joined with a space (not `.`) so kepler.gl's
 * file-extension stripper doesn't truncate the auto-derived layer label.
 *
 * Quotes and `""` escapes are stripped during normalization.
 */
export function computeKeplerDatasetLabel(tableName: string): string {
  const normalizedParts = splitQualifiedIdentifier(String(tableName)).map(
    normalizeIdentifierPart,
  );
  const fallback = normalizedParts.join('.');

  if (normalizedParts.length === 1) {
    return normalizedParts[0] ?? fallback;
  }

  if (normalizedParts.length === 2) {
    const [schema, table] = normalizedParts;
    if (schema === 'main') return table ?? fallback;
    return [schema, table].filter(Boolean).join(' ');
  }

  if (normalizedParts.length === 3) {
    const [, schema, table] = normalizedParts;
    if (schema === 'main') return table ?? fallback;
    return [schema, table].filter(Boolean).join(' ');
  }

  return fallback;
}
