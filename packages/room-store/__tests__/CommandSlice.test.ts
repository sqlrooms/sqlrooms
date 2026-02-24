import {createStore} from 'zustand';
import {jest} from '@jest/globals';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  isRoomSliceWithDestroy,
  isRoomSliceWithInitialize,
} from '../src';

type LifecycleSlice = {
  feature: {
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
  };
};

type StoreState = BaseRoomStoreState & LifecycleSlice;

function createTestStore({
  onInitialize = async () => {},
  onDestroy = async () => {},
  captureException,
}: {
  onInitialize?: () => Promise<void>;
  onDestroy?: () => Promise<void>;
  captureException?: (error: unknown) => void;
} = {}) {
  return createStore<StoreState>()((...args) => ({
    ...createBaseRoomSlice({captureException})(...args),
    feature: {
      initialize: onInitialize,
      destroy: onDestroy,
    },
  }));
}

describe('BaseRoomStore', () => {
  it('starts with room.initialized = false', () => {
    const store = createTestStore();
    expect(store.getState().room.initialized).toBe(false);
  });

  it('runs initialize() for non-room slices that expose it', async () => {
    const initialize = jest.fn(async () => {});
    const store = createTestStore({onInitialize: initialize});

    await store.getState().room.initialize();

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('runs destroy() for non-room slices that expose it', async () => {
    const destroy = jest.fn(async () => {});
    const store = createTestStore({onDestroy: destroy});

    await store.getState().room.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('uses provided captureException handler when supplied', () => {
    const captureException = jest.fn();
    const store = createTestStore({captureException});
    const error = new Error('boom');

    store.getState().room.captureException(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });

  it('falls back to console.error captureException by default', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const store = createTestStore();
    const error = new Error('fallback');

    store.getState().room.captureException(error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    consoleErrorSpy.mockRestore();
  });

  it('detects lifecycle-capable slices correctly', () => {
    expect(isRoomSliceWithInitialize({initialize: async () => {}})).toBe(true);
    expect(isRoomSliceWithInitialize({})).toBe(false);

    expect(isRoomSliceWithDestroy({destroy: async () => {}})).toBe(true);
    expect(isRoomSliceWithDestroy({})).toBe(false);
  });
});
