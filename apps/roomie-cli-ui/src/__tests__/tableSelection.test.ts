import {describe, expect, it, jest} from '@jest/globals';
import {Selection} from '@sqlrooms/mosaic';
import {
  restoreSelection,
  selectionPredicates,
  synchronizeTableSelection,
  validateTableFilters,
} from '../tableSelection';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('persisted table filters', () => {
  it('restores all saved filters and clears them through the shared Reset action', () => {
    const selection = Selection.crossfilter();
    const predicates = ['"value" >= 10', '"city" = \'Zürich\''];
    restoreSelection(selection, predicates);
    expect(selectionPredicates(selection)).toEqual(predicates);
    selection.reset();
    expect(selectionPredicates(selection)).toEqual([]);
  });

  it('replaces an existing restored filter set without retaining stale clauses', () => {
    const selection = Selection.crossfilter();
    restoreSelection(selection, ['"value" >= 10']);
    restoreSelection(selection, ['"value" < 5']);
    expect(selectionPredicates(selection)).toEqual(['"value" < 5']);
    restoreSelection(selection, []);
    expect(selectionPredicates(selection)).toEqual([]);
  });

  it('never saves intermediate reset events while applying a new saved filter set', async () => {
    const selection = Selection.crossfilter();
    restoreSelection(selection, ['"value" < 5']);
    const save = jest.fn();
    const sync = synchronizeTableSelection(selection, save);
    sync.restore(['"value" >= 10', '"value" < 20']);
    await settle();
    expect(selectionPredicates(selection)).toEqual([
      '"value" >= 10',
      '"value" < 20',
    ]);
    expect(save).not.toHaveBeenCalled();
    selection.reset();
    await settle();
    expect(save).toHaveBeenCalledWith([]);
    sync.dispose();
  });

  it('handles queued restores and an empty final state while Mosaic clients are pending', async () => {
    const selection = Selection.crossfilter();
    restoreSelection(selection, ['"value" < 5']);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    selection.addEventListener('value', () => pending);
    const save = jest.fn();
    const sync = synchronizeTableSelection(selection, save);
    sync.restore(['"value" >= 10']);
    sync.restore(['"value" > 20']);
    release();
    await settle();
    expect(selectionPredicates(selection)).toEqual(['"value" > 20']);
    expect(save).not.toHaveBeenCalled();
    sync.restore([]);
    await settle();
    expect(selectionPredicates(selection)).toEqual([]);
    expect(save).not.toHaveBeenCalled();
    restoreSelection(selection, ['"value" = 30']);
    await settle();
    expect(save).toHaveBeenLastCalledWith(['"value" = 30']);
    sync.dispose();
  });
});

describe('table filter admission', () => {
  const dbWith = (statements: unknown[]) => {
    const getConnector = jest.fn();
    const sqlSelectToJson = jest.fn(async (_sql: string) => ({
      error: false,
      statements,
    }));
    return {
      db: {getConnector, sqlSelectToJson} as unknown as DuckDbSliceState['db'],
      getConnector,
      sqlSelectToJson,
    };
  };

  it('validates each ordinary filter without executing or binding it', async () => {
    const {db, sqlSelectToJson, getConnector} = dbWith([
      {node: {type: 'SELECT_NODE', where_clause: {class: 'COMPARISON'}}},
    ]);
    await validateTableFilters(db, ['"value" >= 10', '"value" < 20']);
    expect(sqlSelectToJson.mock.calls.map((call) => call[0])).toEqual([
      'SELECT 1 WHERE ("value" >= 10)',
      'SELECT 1 WHERE ("value" < 20)',
    ]);
    expect(getConnector).not.toHaveBeenCalled();
  });

  it.each([
    {type: 'TABLE_FUNCTION', function: {function_name: 'read_csv_auto'}},
    {class: 'FUNCTION', function_name: 'unverified_macro'},
    {type: 'BASE_TABLE', schema_name: '__roomie', table_name: 'ui_state'},
    {class: 'FUNCTION', function_name: 'query'},
  ])(
    'rejects external, unverified, internal, and dynamic SQL without binding it: $type $function_name',
    async (where_clause) => {
      const {db, getConnector} = dbWith([
        {node: {type: 'SELECT_NODE', where_clause}},
      ]);
      await expect(
        validateTableFilters(db, ['unsafe predicate']),
      ).rejects.toThrow();
      expect(getConnector).not.toHaveBeenCalled();
    },
  );

  it('rejects a predicate that escapes into a second statement', async () => {
    const {db, getConnector} = dbWith([
      {node: {type: 'SELECT_NODE'}},
      {node: {type: 'COPY_NODE'}},
    ]);
    await expect(
      validateTableFilters(db, [
        "true); COPY events TO '/tmp/output.csv'; SELECT (true",
      ]),
    ).rejects.toThrow('Only one SELECT');
    expect(getConnector).not.toHaveBeenCalled();
  });
});
