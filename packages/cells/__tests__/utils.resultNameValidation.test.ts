import {getResultNameValidationError} from '../src/utils';

const identity = (s: string) => s;

function makeCell(id: string, resultName?: string, sql = '') {
  return {
    id,
    type: 'sql' as const,
    data: {
      title: `SQL ${id}`,
      sql,
      resultName,
    },
  };
}

describe('getResultNameValidationError', () => {
  it('returns null for a valid, unused name', () => {
    const cells = {a: makeCell('a', 'result_a')};
    expect(
      getResultNameValidationError({
        proposedName: 'result_b',
        currentCellId: 'b',
        currentCellSql: 'SELECT 1',
        sheetCellIds: ['a', 'b'],
        cells,
        mainSchemaTableNames: [],
        convertToValidName: identity,
      }),
    ).toBeNull();
  });

  it('returns an error when another cell already uses the name', () => {
    const cells = {
      a: makeCell('a', 'result_1'),
      b: makeCell('b'),
    };
    const error = getResultNameValidationError({
      proposedName: 'result_1',
      currentCellId: 'b',
      currentCellSql: 'SELECT 1',
      sheetCellIds: ['a', 'b'],
      cells,
      mainSchemaTableNames: [],
      convertToValidName: identity,
    });
    expect(error).not.toBeNull();
    expect(error).toMatch(/another cell/i);
  });

  it('does not flag the current cell using its own existing name', () => {
    // Cell 'a' explicitly has result_1, so cell 'a' trying to keep result_1 is fine.
    const cells = {a: makeCell('a', 'result_1')};
    expect(
      getResultNameValidationError({
        proposedName: 'result_1',
        currentCellId: 'a',
        currentCellSql: 'SELECT 1',
        sheetCellIds: ['a'],
        cells,
        mainSchemaTableNames: [],
        convertToValidName: identity,
      }),
    ).toBeNull();
  });

  it('returns an error when the name conflicts with a main-schema table', () => {
    const cells = {a: makeCell('a')};
    const error = getResultNameValidationError({
      proposedName: 'earthquakes',
      currentCellId: 'a',
      currentCellSql: 'SELECT 1',
      sheetCellIds: ['a'],
      cells,
      mainSchemaTableNames: ['earthquakes'],
      convertToValidName: identity,
    });
    expect(error).not.toBeNull();
    expect(error).toMatch(/existing table/i);
  });

  it('is case-insensitive when checking main-schema table names', () => {
    const cells = {a: makeCell('a')};
    const error = getResultNameValidationError({
      proposedName: 'Earthquakes',
      currentCellId: 'a',
      currentCellSql: 'SELECT 1',
      sheetCellIds: ['a'],
      cells,
      mainSchemaTableNames: ['earthquakes'],
      convertToValidName: identity,
    });
    expect(error).not.toBeNull();
  });

  it('is case-insensitive when checking name collisions with other cells', () => {
    const cells = {
      a: makeCell('a', 'Result_One'),
      b: makeCell('b'),
    };
    const error = getResultNameValidationError({
      proposedName: 'result_one',
      currentCellId: 'b',
      currentCellSql: 'SELECT 1',
      sheetCellIds: ['a', 'b'],
      cells,
      mainSchemaTableNames: [],
      convertToValidName: identity,
    });
    expect(error).not.toBeNull();
  });

  it('returns an error for a self-reference cycle', () => {
    // The cell references "my_result" in its SQL; if named "my_result" it
    // would reference itself.
    const cells = {a: makeCell('a')};
    const error = getResultNameValidationError({
      proposedName: 'my_result',
      currentCellId: 'a',
      currentCellSql: 'SELECT * FROM my_result WHERE id > 0',
      sheetCellIds: ['a'],
      cells,
      mainSchemaTableNames: [],
      convertToValidName: identity,
    });
    expect(error).not.toBeNull();
    expect(error).toMatch(/cycle/i);
  });

  it('does not flag a cycle when the name only appears inside a string literal', () => {
    // "my_result" is inside quotes — not an identifier reference.
    const cells = {a: makeCell('a')};
    expect(
      getResultNameValidationError({
        proposedName: 'my_result',
        currentCellId: 'a',
        currentCellSql: "SELECT 'my_result' AS label",
        sheetCellIds: ['a'],
        cells,
        mainSchemaTableNames: [],
        convertToValidName: identity,
      }),
    ).toBeNull();
  });

  it('does not flag cells in other sheets', () => {
    // cell_b is in a different sheet, so it should not affect validation for cell_a
    const cells = {
      cell_a: makeCell('cell_a'),
      cell_b: makeCell('cell_b', 'my_view'),
    };
    // cell_b is NOT in sheetCellIds for this sheet
    expect(
      getResultNameValidationError({
        proposedName: 'my_view',
        currentCellId: 'cell_a',
        currentCellSql: 'SELECT 1',
        sheetCellIds: ['cell_a'],
        cells,
        mainSchemaTableNames: [],
        convertToValidName: identity,
      }),
    ).toBeNull();
  });

  it('uses effective result name from title when no explicit resultName is set', () => {
    // cell_a has no explicit resultName, so its effective name is derived from
    // title "SQL 2" → "result_2" by getEffectiveResultName
    const convertToValidName = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '_');
    const cellA = {
      id: 'cell_a',
      type: 'sql' as const,
      data: {title: 'SQL 2', sql: 'SELECT 1', resultName: undefined},
    };
    const cells = {cell_a: cellA};
    const error = getResultNameValidationError({
      proposedName: 'result_2',
      currentCellId: 'cell_b',
      currentCellSql: 'SELECT 1',
      sheetCellIds: ['cell_a', 'cell_b'],
      cells,
      mainSchemaTableNames: [],
      convertToValidName,
    });
    expect(error).not.toBeNull();
    expect(error).toMatch(/another cell/i);
  });
});
