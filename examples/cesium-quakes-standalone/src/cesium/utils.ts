/**
 * Normalize a date/time string to ISO 8601 format for Cesium's JulianDate.fromIso8601().
 *
 * DuckDB TIMESTAMP values serialize as "YYYY-MM-DD HH:MM:SS" (space-separated),
 * but Cesium requires "YYYY-MM-DDTHH:MM:SSZ" (T separator, Z suffix).
 *
 * Handles: "1967-01-15 08:23:00" → "1967-01-15T08:23:00Z"
 * Passes through strings that are already ISO 8601.
 */
export function toIso8601(dateStr: string): string {
  // Already has T separator — assume valid ISO 8601
  if (dateStr.includes('T')) return dateStr;

  // Replace first space with T and append Z if no timezone
  const normalized = dateStr.replace(' ', 'T');
  if (
    !normalized.endsWith('Z') &&
    !normalized.includes('+') &&
    !normalized.includes('-', 11)
  ) {
    return normalized + 'Z';
  }
  return normalized;
}
