/** Quote a DuckDB identifier without allowing it to escape the identifier. */
export function escapeIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
