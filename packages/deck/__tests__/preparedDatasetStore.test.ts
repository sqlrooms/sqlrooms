import {Table, vectorFromArray} from 'apache-arrow';
import type {QueryHandle} from '@sqlrooms/duckdb';
import {jest} from '@jest/globals';
import type {PreparedDeckDataset} from '../src/prepare/types';
import {
  createPreparedDatasetStore,
  resolvePreparedDeckDatasetState,
} from '../src/datasets/preparedDatasetStore';
import {resolvePreparedDatasetCacheKey} from '../src/datasets/helpers';
import type {DeckDatasetInput} from '../src/types';

function createPreparedDataset(datasetId: string, table: Table) {
  return {
    datasetId,
    table,
    datasetGeometryColumn: undefined,
    resolveGeometry: (() => {
      throw new Error('Not used in preparedDatasetStore tests.');
    }) as PreparedDeckDataset['resolveGeometry'],
    getGeoArrowLayerData: (() => {
      throw new Error('Not used in preparedDatasetStore tests.');
    }) as PreparedDeckDataset['getGeoArrowLayerData'],
    getGeoJsonBinaryData: (() => {
      throw new Error('Not used in preparedDatasetStore tests.');
    }) as PreparedDeckDataset['getGeoJsonBinaryData'],
  } satisfies PreparedDeckDataset;
}

async function waitForEntry(
  store: ReturnType<typeof createPreparedDatasetStore>,
  cacheKey: string,
) {
  const entry = store.getState().entries[cacheKey];
  if (entry?.status === 'loading') {
    await entry.promise;
  }
}

describe('PreparedDatasetStore', () => {
  it('reuses one prepared entry for matching sql datasets', async () => {
    const table = new Table({value: vectorFromArray([1, 2, 3])});
    const connector = {};
    const prepareDataset = jest.fn(
      ({datasetId, table: nextTable}: {datasetId: string; table: Table}) =>
        createPreparedDataset(datasetId, nextTable),
    );
    const executeSql = jest.fn(
      async () => Promise.resolve(table) as unknown as QueryHandle,
    );
    const store = createPreparedDatasetStore({prepareDataset});
    const input: DeckDatasetInput = {sqlQuery: 'select * from earthquakes'};
    const cacheKey = resolvePreparedDatasetCacheKey({
      input,
      sqlSourceIdentity: connector,
    })!;

    store.getState().syncConsumer('consumer-a', [cacheKey]);
    store.getState().ensureEntry({
      cacheKey,
      datasetId: 'earthquakes',
      executeSql,
      input,
    });
    store.getState().syncConsumer('consumer-b', [cacheKey]);
    store.getState().ensureEntry({
      cacheKey,
      datasetId: 'earthquakes-copy',
      executeSql,
      input,
    });

    await waitForEntry(store, cacheKey);

    expect(executeSql).toHaveBeenCalledTimes(1);
    expect(prepareDataset).toHaveBeenCalledTimes(1);
    expect(store.getState().entries[cacheKey]).toMatchObject({
      status: 'ready',
    });

    const secondState = resolvePreparedDeckDatasetState({
      datasetId: 'earthquakes-copy',
      entry: store.getState().entries[cacheKey],
    });
    expect(secondState.status).toBe('ready');
    if (secondState.status === 'ready') {
      expect(secondState.prepared.datasetId).toBe('earthquakes-copy');
      expect(secondState.prepared.table).toBe(table);
    }
  });

  it('reuses one prepared entry for matching arrow tables', async () => {
    const table = new Table({value: vectorFromArray([1, 2, 3])});
    const prepareDataset = jest.fn(
      ({datasetId, table: nextTable}: {datasetId: string; table: Table}) =>
        createPreparedDataset(datasetId, nextTable),
    );
    const store = createPreparedDatasetStore({prepareDataset});
    const input: DeckDatasetInput = {arrowTable: table, geometryColumn: 'geom'};
    const cacheKey = resolvePreparedDatasetCacheKey({input})!;

    store.getState().syncConsumer('consumer-a', [cacheKey]);
    store.getState().ensureEntry({
      cacheKey,
      datasetId: 'earthquakes',
      executeSql: jest.fn(),
      input,
    });
    store.getState().syncConsumer('consumer-b', [cacheKey]);
    store.getState().ensureEntry({
      cacheKey,
      datasetId: 'earthquakes-copy',
      executeSql: jest.fn(),
      input,
    });

    await waitForEntry(store, cacheKey);

    expect(prepareDataset).toHaveBeenCalledTimes(1);
    expect(store.getState().entries[cacheKey]).toMatchObject({
      status: 'ready',
    });
  });

  it('changes cache keys when geometry options or sql source change', () => {
    const table = new Table({value: vectorFromArray([1, 2, 3])});
    const connectorA = {};
    const connectorB = {};

    const sqlInput: DeckDatasetInput = {
      sqlQuery: 'select * from earthquakes',
      geometryColumn: 'geom',
    };
    const sqlKeyA = resolvePreparedDatasetCacheKey({
      input: sqlInput,
      sqlSourceIdentity: connectorA,
    });
    const sqlKeyB = resolvePreparedDatasetCacheKey({
      input: sqlInput,
      sqlSourceIdentity: connectorB,
    });
    const sqlKeyDifferentGeometry = resolvePreparedDatasetCacheKey({
      input: {
        sqlQuery: 'select * from earthquakes',
        geometryColumn: 'shape',
      },
      sqlSourceIdentity: connectorA,
    });

    expect(sqlKeyA).not.toBe(sqlKeyB);
    expect(sqlKeyA).not.toBe(sqlKeyDifferentGeometry);

    const arrowKey = resolvePreparedDatasetCacheKey({
      input: {arrowTable: table, geometryColumn: 'geom'},
    });
    const arrowKeyDifferentEncoding = resolvePreparedDatasetCacheKey({
      input: {
        arrowTable: table,
        geometryColumn: 'geom',
        geometryEncodingHint: 'wkb',
      },
    });
    const arrowKeyUndefined = resolvePreparedDatasetCacheKey({
      input: {arrowTable: undefined, geometryColumn: 'geom'},
    });

    expect(arrowKey).not.toBe(arrowKeyDifferentEncoding);
    expect(arrowKeyUndefined).toBeUndefined();
  });

  it('returns loading when no prepared entry exists yet', () => {
    expect(
      resolvePreparedDeckDatasetState({
        datasetId: 'earthquakes',
        entry: undefined,
      }),
    ).toEqual({status: 'loading'});
  });

  it('evicts least recently used unreferenced settled entries', async () => {
    const table = new Table({value: vectorFromArray([1, 2, 3])});
    const prepareDataset = jest.fn(
      ({datasetId, table: nextTable}: {datasetId: string; table: Table}) =>
        createPreparedDataset(datasetId, nextTable),
    );
    const executeSql = jest.fn(
      async () => Promise.resolve(table) as unknown as QueryHandle,
    );
    const connector = {};
    const store = createPreparedDatasetStore({
      maxEntries: 1,
      prepareDataset,
    });

    const firstInput: DeckDatasetInput = {sqlQuery: 'select 1'};
    const firstKey = resolvePreparedDatasetCacheKey({
      input: firstInput,
      sqlSourceIdentity: connector,
    })!;

    store.getState().syncConsumer('consumer-a', [firstKey]);
    store.getState().ensureEntry({
      cacheKey: firstKey,
      datasetId: 'first',
      executeSql,
      input: firstInput,
    });
    await waitForEntry(store, firstKey);
    store.getState().removeConsumer('consumer-a');

    const secondInput: DeckDatasetInput = {sqlQuery: 'select 2'};
    const secondKey = resolvePreparedDatasetCacheKey({
      input: secondInput,
      sqlSourceIdentity: connector,
    })!;

    store.getState().syncConsumer('consumer-b', [secondKey]);
    store.getState().ensureEntry({
      cacheKey: secondKey,
      datasetId: 'second',
      executeSql,
      input: secondInput,
    });
    await waitForEntry(store, secondKey);

    expect(store.getState().entries[firstKey]).toBeUndefined();
    expect(store.getState().entries[secondKey]).toMatchObject({
      status: 'ready',
    });
  });
});
