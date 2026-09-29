import {describe, expect, it, jest} from '@jest/globals';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {assertLocalRenderQuery} from '../renderQueryPolicy';

describe('HTML render query admission', () => {
  const database = (node: Record<string, unknown>) => {
    const getConnector = jest.fn();
    return {
      db: {
        getConnector,
        sqlSelectToJson: async () => ({error: false, statements: [{node}]}),
      } as unknown as DuckDbSliceState['db'],
      getConnector,
    };
  };

  it('allows ordinary SELECT expressions', async () => {
    const {db, getConnector} = database({type: 'SELECT_NODE'});
    await assertLocalRenderQuery(db, 'select 1');
    expect(getConnector).not.toHaveBeenCalled();
  });

  it.each([
    {type: 'TABLE_FUNCTION', function: {function_name: 'read_csv_auto'}},
    {class: 'FUNCTION', function_name: 'unverified_macro'},
    {type: 'BASE_TABLE', schema_name: '__roomie', table_name: 'ui_state'},
    {class: 'FUNCTION', function_name: 'query'},
  ])(
    'rejects unsafe sources before binding or executing them: %p',
    async (source) => {
      const {db, getConnector} = database({
        type: 'SELECT_NODE',
        from_table: source,
      });
      await expect(
        assertLocalRenderQuery(db, 'untrusted SELECT'),
      ).rejects.toThrow();
      expect(getConnector).not.toHaveBeenCalled();
    },
  );

  it('rejects writes before touching a source', async () => {
    const {db, getConnector} = database({type: 'COPY_NODE'});
    await expect(
      assertLocalRenderQuery(db, "copy sales to '/tmp/file.csv'"),
    ).rejects.toThrow('Only one SELECT');
    expect(getConnector).not.toHaveBeenCalled();
  });
});
