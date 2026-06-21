import {Coordinator} from '@uwdata/mosaic-core';
import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createMosaicSlice,
  type MosaicPreAggregateOptions,
  type MosaicSliceState,
} from '../src/MosaicSlice';

function createTestStore(
  coordinator: Coordinator,
  preagg?: MosaicPreAggregateOptions,
) {
  return createStore<BaseRoomStoreState & MosaicSliceState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createMosaicSlice({
      coordinator,
      preagg,
    })(...args),
  }));
}

describe('MosaicSlice', () => {
  it('applies pre-aggregate options to the coordinator', async () => {
    const coordinator = new Coordinator();
    const store = createTestStore(coordinator, {
      schema: '__sqlrooms_mosaic_cache.mosaic',
      enabled: false,
    });

    await store.getState().mosaic.initialize();

    expect(coordinator.preaggregator.schema).toBe(
      '__sqlrooms_mosaic_cache.mosaic',
    );
    expect(coordinator.preaggregator.enabled).toBe(false);
    expect(store.getState().mosaic.connection).toMatchObject({
      status: 'ready',
      coordinator,
    });
  });

  it('applies a schema-only pre-aggregate config', async () => {
    const coordinator = new Coordinator();
    const store = createTestStore(coordinator, {
      schema: '__sqlrooms_mosaic_cache.mosaic',
    });

    await store.getState().mosaic.initialize();

    expect(coordinator.preaggregator.schema).toBe(
      '__sqlrooms_mosaic_cache.mosaic',
    );
    expect(coordinator.preaggregator.enabled).toBe(true);
  });

  it('applies an enabled-only pre-aggregate config', async () => {
    const coordinator = new Coordinator();
    const store = createTestStore(coordinator, {enabled: false});

    await store.getState().mosaic.initialize();

    expect(coordinator.preaggregator.schema).toBe('mosaic');
    expect(coordinator.preaggregator.enabled).toBe(false);
  });

  it('preserves pre-aggregate defaults when config is omitted', async () => {
    const coordinator = new Coordinator();
    const store = createTestStore(coordinator);

    await store.getState().mosaic.initialize();

    expect(coordinator.preaggregator.schema).toBe('mosaic');
    expect(coordinator.preaggregator.enabled).toBe(true);
  });
});
