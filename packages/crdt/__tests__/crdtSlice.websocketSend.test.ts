import {describe, expect, it} from '@jest/globals';
import {LoroDoc} from 'loro-crdt';
import {schema} from 'loro-mirror';
import {createStore} from 'zustand/vanilla';

import {
  createCrdtSlice,
  createWebSocketSyncConnector,
  type CrdtSliceState,
} from '../src';

type Listener = (event: any) => void;

class FakeWebSocket {
  readyState = 0;
  sent: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {code: 1000, reason: ''});
  }

  open() {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(data: any) {
    this.emit('message', {data});
  }

  private emit(type: string, event: any) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of Array.from(set)) listener(event);
  }
}

type AppState = CrdtSliceState & {
  counter: number;
  setCounter: (value: number) => void;
};

const mirrorSchema = schema({
  shared: schema.LoroMap({
    counter: schema.Number(),
  }),
});

describe('CRDT slice + WebSocket sync', () => {
  it('sends a binary CRDT update when store state changes (after join)', async () => {
    const ws = new FakeWebSocket();
    const connector = createWebSocketSyncConnector({
      url: 'ws://example.test',
      roomId: 'room-1',
      sendSnapshotOnConnect: false,
      createSocket: () => ws,
    });

    const doc = new LoroDoc();

    const store = createStore<AppState>()((set, get, api) =>
      Object.assign(
        {
          counter: 0,
          setCounter: (value) => set({counter: value}),
        },
        createCrdtSlice<{counter: number}, typeof mirrorSchema>({
          doc,
          schema: mirrorSchema,
          bindings: [
            {
              key: 'shared',
              select: (s) => ({counter: (s as any).counter}) as any,
              apply: (value) => set({counter: (value as any).counter}),
            },
          ],
          sync: connector,
        })(set as any, get as any, api as any),
      ),
    );

    await store.getState().crdt.initialize();

    // Open + join.
    ws.open();
    ws.message(JSON.stringify({type: 'crdt-joined', roomId: 'room-1'}));

    const sentBefore = ws.sent.length;
    store.getState().setCounter(123);
    await Promise.resolve();

    expect(ws.sent.length).toBeGreaterThan(sentBefore);
    expect(ws.sent.some((m) => typeof m !== 'string')).toBe(true);
  });
});
