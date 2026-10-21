const READ_QUERY_NODES = new Set([
  'SELECT_NODE',
  'SET_OPERATION_NODE',
  'RECURSIVE_CTE_NODE',
  'CTE_NODE',
]);

/**
 * Whether DuckDB's serialized SQL contains exactly one SELECT and only known
 * read query nodes, including nested CTEs and subqueries.
 *
 * Supports both legacy `children` and structured `arguments` expressions.
 * This structural check does not establish that functions, macros, views or
 * external sources are safe. Apply the host's source/approval policy as well.
 * Unknown query node kinds fail closed.
 *
 * @param parsed - The result of DuckDB's `json_serialize_sql`.
 */
export function isReadOnlySqlSelect(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const result = parsed as {
    error?: unknown;
    statements?: {node?: {type?: unknown}}[];
  };
  if (
    result.error !== false ||
    !Array.isArray(result.statements) ||
    result.statements.length !== 1 ||
    !READ_QUERY_NODES.has(String(result.statements[0]?.node?.type))
  )
    return false;

  function isReadQuery(value: unknown): boolean {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every(isReadQuery);
    const node = value as Record<string, unknown>;
    if (
      typeof node.type === 'string' &&
      node.type.endsWith('_NODE') &&
      !READ_QUERY_NODES.has(node.type)
    )
      return false;
    return Object.values(node).every(isReadQuery);
  }
  return isReadQuery(result.statements);
}
