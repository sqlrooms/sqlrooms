import {getSqlQueryPreview} from '../src/utils';

describe('getSqlQueryPreview', () => {
  it('returns empty object for empty input', () => {
    expect(getSqlQueryPreview('')).toEqual({
      firstLine: '',
      hasMoreLines: false,
    });
  });

  it('returns empty object for whitespace-only input', () => {
    expect(getSqlQueryPreview('   ')).toEqual({
      firstLine: '',
      hasMoreLines: false,
    });
    expect(getSqlQueryPreview('\n\n  \n')).toEqual({
      firstLine: '',
      hasMoreLines: false,
    });
    expect(getSqlQueryPreview('\t\n  \t')).toEqual({
      firstLine: '',
      hasMoreLines: false,
    });
  });

  it('returns single line without more lines indicator', () => {
    const result = getSqlQueryPreview('SELECT * FROM users');
    expect(result).toEqual({
      firstLine: 'SELECT * FROM users',
      hasMoreLines: false,
    });
  });

  it('returns first non-empty line with more lines indicator', () => {
    const sql = `SELECT * FROM users
WHERE active = true`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: 'SELECT * FROM users',
      hasMoreLines: true,
    });
  });

  it('skips leading empty lines', () => {
    const sql = `

SELECT * FROM users`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: 'SELECT * FROM users',
      hasMoreLines: false,
    });
  });

  it('skips leading whitespace-only lines', () => {
    const sql = `

SELECT * FROM users
WHERE active = true`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: 'SELECT * FROM users',
      hasMoreLines: true,
    });
  });

  it('handles trailing empty lines correctly', () => {
    const sql = `SELECT * FROM users


`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: 'SELECT * FROM users',
      hasMoreLines: false,
    });
  });

  it('detects multiple non-empty lines', () => {
    const sql = `SELECT *
FROM users
WHERE active = true`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: 'SELECT *',
      hasMoreLines: true,
    });
  });

  it('handles lines with only indentation', () => {
    const sql = `  SELECT * FROM users

  WHERE active = true`;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: '  SELECT * FROM users',
      hasMoreLines: true,
    });
  });

  it('preserves leading/trailing whitespace in content lines', () => {
    const sql = `  SELECT * FROM users  `;
    const result = getSqlQueryPreview(sql);
    expect(result).toEqual({
      firstLine: '  SELECT * FROM users  ',
      hasMoreLines: false,
    });
  });
});
