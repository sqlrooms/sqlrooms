import {
  formatColumnForRunContext,
  formatTableColumnsForRunContext,
  MAX_COLUMN_TYPE_CHARS,
  MAX_COLUMNS_IN_RUN_CONTEXT,
} from '../context/formatRunContextInstructions';

describe('formatTableColumnsForRunContext', () => {
  it('returns empty string when there are no columns', () => {
    expect(formatTableColumnsForRunContext([])).toBe('');
  });

  it('lists all columns when under the cap', () => {
    const text = formatTableColumnsForRunContext([
      {name: 'id', type: 'BIGINT'},
      {name: 'Magnitude', type: 'DOUBLE'},
    ]);
    expect(text).toBe('\n    columns: id (BIGINT), Magnitude (DOUBLE)');
  });

  it('caps listed columns and reports how many were omitted', () => {
    const columns = Array.from(
      {length: MAX_COLUMNS_IN_RUN_CONTEXT + 7},
      (_, i) => ({
        name: `col_${i}`,
        type: 'INTEGER',
      }),
    );
    const text = formatTableColumnsForRunContext(columns);
    expect(text.startsWith('\n    columns: ')).toBe(true);
    expect(text).toContain('col_0 (INTEGER)');
    expect(text).toContain(`col_${MAX_COLUMNS_IN_RUN_CONTEXT - 1} (INTEGER)`);
    expect(text).not.toContain(`col_${MAX_COLUMNS_IN_RUN_CONTEXT} (INTEGER)`);
    expect(text.endsWith(' (+7 more)')).toBe(true);
  });

  it('truncates very long DuckDB type strings', () => {
    const longType = `STRUCT(${'x VARCHAR, '.repeat(20)}y INTEGER)`;
    expect(longType.length).toBeGreaterThan(MAX_COLUMN_TYPE_CHARS);
    expect(formatColumnForRunContext({name: 'payload', type: longType})).toBe(
      `payload (${longType.slice(0, MAX_COLUMN_TYPE_CHARS)}…)`,
    );
  });
});
