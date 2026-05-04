import {Coordinator} from '@uwdata/mosaic-core';
import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createMosaicSlice, type MosaicSliceState} from '../src/MosaicSlice';

function createTestStore(coordinator: Coordinator) {
  return createStore<BaseRoomStoreState & MosaicSliceState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createMosaicSlice({
      coordinator,
      preagg: {
        schema: '__sqlrooms_mosaic_cache.mosaic',
        enabled: false,
      },
    })(...args),
  }));
}

describe('MosaicSlice', () => {
  it('applies pre-aggregate options to the coordinator', async () => {
    const coordinator = new Coordinator();
    const store = createTestStore(coordinator);

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
});
