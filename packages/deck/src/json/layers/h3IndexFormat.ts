/**
 * Convert an H3 cell id from Arrow/DuckDB into the hex string H3HexagonLayer expects.
 *
 * DuckDB `h3_latlng_to_cell` returns UBIGINT. Arrow often surfaces that as a
 * 64-bit int whose `.get()` value is a JS bigint. `String(bigint)` is decimal
 * (invalid for deck.gl); use base-16. Also normalize signed Int64 via asUintN
 * so high-bit indexes stay valid hex.
 */
export function formatH3IndexForDeck(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'bigint') {
    return BigInt.asUintN(64, value).toString(16);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Unsafe for full H3 range; only reached for unusual narrow integer types.
    return BigInt.asUintN(64, BigInt(Math.trunc(value))).toString(16);
  }
  return String(value);
}
