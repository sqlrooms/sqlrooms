export const AIRLINE_COLOR_PALETTE = [
  ['UAL', '#2563eb'],
  ['DAL', '#ef4444'],
  ['AAL', '#94a3b8'],
  ['JBU', '#06b6d4'],
  ['SWA', '#f59e0b'],
  ['RPA', '#8b5cf6'],
  ['EDV', '#22c55e'],
  ['FFT', '#10b981'],
  ['NKS', '#f97316'],
  ['ASA', '#14b8a6'],
  ['ACA', '#ec4899'],
  ['EJA', '#6366f1'],
  ['LXJ', '#f43f5e'],
  ['GJS', '#84cc16'],
  ['JZA', '#d946ef'],
  ['VJA', '#38bdf8'],
  ['EJM', '#a855f7'],
  ['JRE', '#fb7185'],
  ['MXY', '#fde047'],
  ['BAW', '#1d4ed8'],
  ['JSX', '#fb7185'],
  ['GPD', '#2dd4bf'],
  ['JIA', '#dc2626'],
  ['PTR', '#65a30d'],
  ['ENY', '#64748b'],
  ['XFL', '#c026d3'],
  ['KOW', '#a16207'],
  ['CNS', '#0f766e'],
  ['UPS', '#92400e'],
  ['AFR', '#1e3a8a'],
  ['Unknown', '#64748b'],
] as const;

export const AIRLINE_COLOR_DOMAIN = AIRLINE_COLOR_PALETTE.map(([code]) => code);

export const AIRLINE_COLOR_RANGE = AIRLINE_COLOR_PALETTE.map(
  ([, color]) => color,
);

function escapeSqlString(value: string) {
  return value.split("'").join("''");
}

export function buildAirlineCodeSql(callsignExpression: string) {
  return `
    CASE
      WHEN regexp_extract(coalesce(${callsignExpression}, ''), '^([A-Z]{3})', 1) <> ''
        THEN regexp_extract(${callsignExpression}, '^([A-Z]{3})', 1)
      ELSE 'Unknown'
    END
  `;
}

export function buildAirlineColorSql(airlineCodeExpression: string) {
  const cases = AIRLINE_COLOR_PALETTE.map(
    ([code, color]) =>
      `WHEN ${airlineCodeExpression} = '${escapeSqlString(code)}' THEN '${escapeSqlString(color)}'`,
  ).join('\n        ');

  const fallbackColor =
    AIRLINE_COLOR_PALETTE[AIRLINE_COLOR_PALETTE.length - 1][1];

  return `
    CASE
        ${cases}
      ELSE '${escapeSqlString(fallbackColor)}'
    END
  `;
}
