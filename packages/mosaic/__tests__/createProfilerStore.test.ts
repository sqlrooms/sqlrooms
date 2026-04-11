import * as arrow from 'apache-arrow';
import {createProfilerStore} from '../src/profiler/createProfilerStore';

describe('createProfilerStore', () => {
  it('syncs page size by resetting the page index', () => {
    const store = createProfilerStore({
      initialSorting: [],
      pageSize: 100,
    });

    store.getState().setPagination({
      pageIndex: 3,
      pageSize: 100,
    });
    store.getState().syncPageSize(50);

    expect(store.getState().pagination).toEqual({
      pageIndex: 0,
      pageSize: 50,
    });
  });

  it('resets the page index when sorting changes', () => {
    const store = createProfilerStore({
      initialSorting: [],
      pageSize: 100,
    });

    store.getState().setPagination({
      pageIndex: 2,
      pageSize: 100,
    });
    store.getState().setSorting([{desc: true, id: 'value'}]);

    expect(store.getState().pagination.pageIndex).toBe(0);
  });

  it('initializes empty summary state from fields', () => {
    const store = createProfilerStore({
      initialSorting: [],
      pageSize: 100,
    });
    const field = new arrow.Field('value', new arrow.Float64(), true);

    store.getState().initializeSummaries([field]);

    expect(store.getState().summaries.value).toMatchObject({
      isLoading: true,
      kind: 'histogram',
      totalBins: [],
    });
  });
});
