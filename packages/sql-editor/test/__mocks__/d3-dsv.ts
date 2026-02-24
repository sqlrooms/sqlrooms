export function csvFormat(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return '';
  }
  return Object.keys(rows[0] || {}).join(',');
}
