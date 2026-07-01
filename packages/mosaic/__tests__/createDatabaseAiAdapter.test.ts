import {createDuckDbDatabaseAiAdapter as createDuckDbDatabaseAiAdapterFromRoot} from '../src';
import {createDuckDbDatabaseAiAdapter} from '../src/ai';

describe('createDuckDbDatabaseAiAdapter', () => {
  it('is exported from the package root entrypoint', () => {
    expect(createDuckDbDatabaseAiAdapterFromRoot).toBe(
      createDuckDbDatabaseAiAdapter,
    );
  });

  it('adapts DuckDB table catalog and lookup operations for Mosaic AI tools', () => {
    const table = {
      tableName: 'sales',
      table: {schema: 'main', table: 'sales'},
      columns: [],
    } as any;
    const store = {
      getState: () => ({
        db: {
          tables: [table],
          findTable: (tableName: string) =>
            tableName === 'sales' ? table : undefined,
        },
      }),
    } as any;

    const adapter = createDuckDbDatabaseAiAdapter(store);

    expect(adapter.getTables()).toEqual([table]);
    expect(adapter.findTable('sales')).toBe(table);
    expect(adapter.findTable('missing')).toBeUndefined();
  });
});
