/**
 * @jest-environment jsdom
 */
import {describe, expect, test} from '@jest/globals';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {
  createBaseRoomSlice,
  RoomStateProvider,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import {RoomShell} from '../src/RoomShell';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RoomShell.LoadingProgress', () => {
  test('renders with a base-only room store', async () => {
    const store = createStore<BaseRoomStoreState>()(createBaseRoomSlice());
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <RoomShell.LoadingProgress />
        </RoomStateProvider>,
      );
    });

    expect(container.textContent).toBe('');

    await act(async () => root.unmount());
  });
});
