/**
 * Convert Arrow/DuckDB H3 cell ids to hex strings for H3HexagonLayer.
 * Bigint must use base-16 — `String(bigint)` is decimal and invalid for deck.gl.
 */
export function formatH3IndexForDeck(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'bigint') {
    return BigInt.asUintN(64, value).toString(16);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Narrow ints only; unsafe for full H3 range.
    return BigInt.asUintN(64, BigInt(Math.trunc(value))).toString(16);
  }
  return String(value);
}
