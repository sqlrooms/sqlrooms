import {createStore} from 'zustand';
import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';
import {
  createDuckDbSlice,
  DuckDbSliceState,
} from '../../duckdb/src/DuckDbSlice';
import {createBaseRoomSlice, BaseRoomStoreState} from '@sqlrooms/room-store';
import {
  createSqlEditorSlice,
  SqlEditorSliceState,
  isQueryWithResult,
} from '../src/SqlEditorSlice';

type TestStoreState = BaseRoomStoreState &
  DuckDbSliceState &
  SqlEditorSliceState;

function createTestStore() {
  const connector = createNodeDuckDbConnector({
    dbPath: ':memory:',
  });

  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDuckDbSlice({connector})(...args),
    ...createSqlEditorSlice()(...args),
  }));
}

describe('SqlEditorSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    store = createTestStore();
    await store.getState().db.initialize();
    await store.getState().sqlEditor.initialize?.();
  });

  afterEach(async () => {
    await store.getState().sqlEditor.destroy?.();
    await store.getState().db.destroy();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = store.getState().sqlEditor.config;
      expect(config).toBeDefined();
      expect(config.queries).toBeDefined();
      expect(Array.isArray(config.queries)).toBe(true);
    });

    it('should initialize with default query result limit', () => {
      expect(store.getState().sqlEditor.queryResultLimit).toBe(100);
    });

    it('should initialize with limit options', () => {
      expect(store.getState().sqlEditor.queryResultLimitOptions).toEqual([
        100, 500, 1000,
      ]);
    });
  });

  describe('createQueryTab', () => {
    it('should create a new query tab', () => {
      const newQuery = store.getState().sqlEditor.createQueryTab();

      expect(newQuery.id).toBeDefined();
      expect(newQuery.name).toContain('Untitled');
      expect(newQuery.query).toBe('');
    });

    it('should create tab with initial query', () => {
      const newQuery = store
        .getState()
        .sqlEditor.createQueryTab('SELECT * FROM test');

      expect(newQuery.query).toBe('SELECT * FROM test');
    });

    it('should add tab to queries list', () => {
      const initialCount = store.getState().sqlEditor.config.queries.length;
      store.getState().sqlEditor.createQueryTab();

      expect(store.getState().sqlEditor.config.queries.length).toBe(
        initialCount + 1,
      );
    });

    it('should set new tab as selected', () => {
      const newQuery = store.getState().sqlEditor.createQueryTab();

      expect(store.getState().sqlEditor.config.selectedQueryId).toBe(
        newQuery.id,
      );
    });

    it('should generate unique names', () => {
      const query1 = store.getState().sqlEditor.createQueryTab();
      const query2 = store.getState().sqlEditor.createQueryTab();

      expect(query1.name).not.toBe(query2.name);
    });
  });

  describe('deleteQueryTab', () => {
    it('should delete a query tab', () => {
      const newQuery = store.getState().sqlEditor.createQueryTab();
      const initialCount = store.getState().sqlEditor.config.queries.length;

      store.getState().sqlEditor.deleteQueryTab(newQuery.id);

      expect(store.getState().sqlEditor.config.queries.length).toBe(
        initialCount - 1,
      );
    });

    it('should not delete last query tab', () => {
      // Create a store with single query
      const singleQueryStore = createTestStore();
      singleQueryStore.getState().sqlEditor.createQueryTab();

      const queries = singleQueryStore.getState().sqlEditor.config.queries;
      if (queries.length === 1) {
        const queryId = queries[0]?.id;
        if (queryId) {
          singleQueryStore.getState().sqlEditor.deleteQueryTab(queryId);
          expect(
            singleQueryStore.getState().sqlEditor.config.queries.length,
          ).toBe(1);
        }
      }
    });

    it('should select another tab when deleting selected tab', () => {
      const query1 = store.getState().sqlEditor.createQueryTab();
      const query2 = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.setSelectedQueryId(query2.id);
      store.getState().sqlEditor.deleteQueryTab(query2.id);

      expect(store.getState().sqlEditor.config.selectedQueryId).not.toBe(
        query2.id,
      );
    });

    it('should remove query results when deleting tab', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      // Set some results
      store.setState((state) => ({
        ...state,
        sqlEditor: {
          ...state.sqlEditor,
          queryResultsById: {
            ...state.sqlEditor.queryResultsById,
            [query.id]: {
              status: 'success',
              type: 'select',
              result: undefined,
              query: 'SELECT 1',
              lastQueryStatement: 'SELECT 1',
            },
          },
        },
      }));

      store.getState().sqlEditor.deleteQueryTab(query.id);

      expect(
        store.getState().sqlEditor.queryResultsById[query.id],
      ).toBeUndefined();
    });
  });

  describe('renameQueryTab', () => {
    it('should rename a query tab', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.renameQueryTab(query.id, 'New Name');

      const renamed = store
        .getState()
        .sqlEditor.config.queries.find((q) => q.id === query.id);
      expect(renamed?.name).toBe('New Name');
    });

    it('should keep existing name if new name is empty', () => {
      const query = store.getState().sqlEditor.createQueryTab();
      const originalName = query.name;

      store.getState().sqlEditor.renameQueryTab(query.id, '');

      const renamed = store
        .getState()
        .sqlEditor.config.queries.find((q) => q.id === query.id);
      expect(renamed?.name).toBe(originalName);
    });
  });

  describe('updateQueryText', () => {
    it('should update query text', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      store
        .getState()
        .sqlEditor.updateQueryText(query.id, 'SELECT * FROM users');

      const updated = store
        .getState()
        .sqlEditor.config.queries.find((q) => q.id === query.id);
      expect(updated?.query).toBe('SELECT * FROM users');
    });
  });

  describe('setSelectedQueryId', () => {
    it('should change selected query', () => {
      const query1 = store.getState().sqlEditor.createQueryTab();
      const query2 = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.setSelectedQueryId(query1.id);

      expect(store.getState().sqlEditor.config.selectedQueryId).toBe(query1.id);
    });
  });

  describe('getCurrentQuery', () => {
    it('should return current query text', () => {
      const query = store.getState().sqlEditor.createQueryTab('SELECT 42');

      store.getState().sqlEditor.setSelectedQueryId(query.id);

      expect(store.getState().sqlEditor.getCurrentQuery()).toBe('SELECT 42');
    });

    it('should return empty string if no query selected', () => {
      store.getState().sqlEditor.setSelectedQueryId('non-existent');

      expect(store.getState().sqlEditor.getCurrentQuery()).toBe('');
    });
  });

  describe('closeQueryTab', () => {
    it('should remove tab from open tabs', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      expect(store.getState().sqlEditor.config.openTabs).toContain(query.id);

      store.getState().sqlEditor.closeQueryTab(query.id);

      expect(store.getState().sqlEditor.config.openTabs).not.toContain(
        query.id,
      );
    });
  });

  describe('openQueryTab', () => {
    it('should add tab to open tabs', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.closeQueryTab(query.id);
      expect(store.getState().sqlEditor.config.openTabs).not.toContain(
        query.id,
      );

      store.getState().sqlEditor.openQueryTab(query.id);

      expect(store.getState().sqlEditor.config.openTabs).toContain(query.id);
    });

    it('should set as selected when opening', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.closeQueryTab(query.id);
      store.getState().sqlEditor.openQueryTab(query.id);

      expect(store.getState().sqlEditor.config.selectedQueryId).toBe(query.id);
    });
  });

  describe('setOpenTabs', () => {
    it('should update open tabs list', () => {
      const query1 = store.getState().sqlEditor.createQueryTab();
      const query2 = store.getState().sqlEditor.createQueryTab();

      store.getState().sqlEditor.setOpenTabs([query2.id, query1.id]);

      expect(store.getState().sqlEditor.config.openTabs).toEqual([
        query2.id,
        query1.id,
      ]);
    });
  });

  describe('clearQueryResults', () => {
    it('should clear all query results', () => {
      const query = store.getState().sqlEditor.createQueryTab();

      store.setState((state) => ({
        ...state,
        sqlEditor: {
          ...state.sqlEditor,
          queryResultsById: {
            ...state.sqlEditor.queryResultsById,
            [query.id]: {
              status: 'success',
              type: 'select',
              result: undefined,
              query: 'SELECT 1',
              lastQueryStatement: 'SELECT 1',
            },
          },
        },
      }));

      store.getState().sqlEditor.clearQueryResults();

      expect(
        Object.keys(store.getState().sqlEditor.queryResultsById).length,
      ).toBe(0);
    });
  });

  describe('setQueryResultLimit', () => {
    it('should update query result limit', () => {
      store.getState().sqlEditor.setQueryResultLimit(500);

      expect(store.getState().sqlEditor.queryResultLimit).toBe(500);
    });
  });

  describe('parseAndRunQuery', () => {
    it('should execute a simple SELECT query', async () => {
      const query = store
        .getState()
        .sqlEditor.createQueryTab('SELECT 1 as num');
      store.getState().sqlEditor.setSelectedQueryId(query.id);

      await store.getState().sqlEditor.parseAndRunCurrentQuery();

      const result = store.getState().sqlEditor.queryResultsById[query.id];
      expect(result?.status).toBe('success');
      if (result?.status === 'success') {
        expect(result.type).toBe('select');
      }
    });

    it('should not run if query is already running', async () => {
      const query = store.getState().sqlEditor.createQueryTab('SELECT 1');
      store.getState().sqlEditor.setSelectedQueryId(query.id);

      // Set loading state
      store.setState((state) => ({
        ...state,
        sqlEditor: {
          ...state.sqlEditor,
          queryResultsById: {
            ...state.sqlEditor.queryResultsById,
            [query.id]: {
              status: 'loading',
              controller: new AbortController(),
            },
          },
        },
      }));

      await expect(
        store.getState().sqlEditor.parseAndRunQuery('SELECT 1'),
      ).rejects.toThrow('Query already running');
    });

    it('should not run empty query', async () => {
      await expect(
        store.getState().sqlEditor.parseAndRunQuery('   '),
      ).resolves.toBeUndefined();
    });

    it('should handle query errors', async () => {
      const query = store.getState().sqlEditor.createQueryTab('INVALID SQL');
      store.getState().sqlEditor.setSelectedQueryId(query.id);

      await store.getState().sqlEditor.parseAndRunCurrentQuery();

      const result = store.getState().sqlEditor.queryResultsById[query.id];
      expect(result?.status).toBe('error');
    });
  });

  describe('abortCurrentQuery', () => {
    it('should abort running query', async () => {
      const query = store.getState().sqlEditor.createQueryTab('SELECT 1');
      store.getState().sqlEditor.setSelectedQueryId(query.id);

      const controller = new AbortController();
      store.setState((state) => ({
        ...state,
        sqlEditor: {
          ...state.sqlEditor,
          queryResultsById: {
            ...state.sqlEditor.queryResultsById,
            [query.id]: {
              status: 'loading',
              controller,
            },
          },
        },
      }));

      store.getState().sqlEditor.abortCurrentQuery();

      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('isQueryWithResult', () => {
    it('should return true for select query result', () => {
      const result = {
        status: 'success' as const,
        type: 'select' as const,
        result: undefined,
        query: 'SELECT 1',
        lastQueryStatement: 'SELECT 1',
      };

      expect(isQueryWithResult(result)).toBe(true);
    });

    it('should return false for exec query result', () => {
      const result = {
        status: 'success' as const,
        type: 'exec' as const,
        query: 'CREATE TABLE test (id INT)',
        lastQueryStatement: 'CREATE TABLE test (id INT)',
      };

      expect(isQueryWithResult(result)).toBe(false);
    });

    it('should return false for error result', () => {
      const result = {
        status: 'error' as const,
        error: 'Query failed',
      };

      expect(isQueryWithResult(result)).toBe(false);
    });

    it('should return false for loading result', () => {
      const result = {
        status: 'loading' as const,
        controller: new AbortController(),
      };

      expect(isQueryWithResult(result)).toBe(false);
    });
  });

  describe('setConfig', () => {
    it('should update config', () => {
      const newConfig = {
        queries: [
          {
            id: 'custom',
            name: 'Custom Query',
            query: 'SELECT *',
            lastOpenedAt: Date.now(),
          },
        ],
        selectedQueryId: 'custom',
        openTabs: ['custom'],
      };

      store.getState().sqlEditor.setConfig(newConfig);

      expect(store.getState().sqlEditor.config).toEqual(newConfig);
    });
  });
});
