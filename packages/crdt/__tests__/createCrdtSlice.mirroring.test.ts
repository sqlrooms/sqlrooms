import {describe, expect, it} from '@jest/globals';
import {LoroDoc} from 'loro-crdt';
import {schema} from 'loro-mirror';
import {createStore} from 'zustand/vanilla';

import {createCrdtSlice, type CrdtSliceState} from '../src';

type AppState = CrdtSliceState & {
  counter: number;
  title: string;
  setCounter: (value: number) => void;
  setTitle: (value: string) => void;
};

const sharedValueSchema = schema.LoroMap({
  counter: schema.Number(),
  title: schema.String(),
});

describe('createCrdtSlice mirroring', () => {
  it('mirrors store -> doc (emits local update bytes) and doc -> store (import applies)', async () => {
    const docA = new LoroDoc();
    const updatesA: Uint8Array[] = [];
    const unsubA = docA.subscribeLocalUpdates((u) => updatesA.push(u));

    const storeA = createStore<AppState>()((set, get, api) =>
      Object.assign(
        {
          counter: 0,
          title: 'hello',
          setCounter: (value: number) => set({counter: value}),
          setTitle: (value: string) => set({title: value}),
        },
        createCrdtSlice<AppState>({
          doc: docA,
          mirrors: {
            shared: {
              schema: sharedValueSchema,
              select: (s) => ({counter: s.counter, title: s.title}),
              apply: (value) =>
                set({
                  counter: (value as any).counter,
                  title: (value as any).title,
                }),
            },
          },
        })(set as any, get as any, api as any),
      ),
    );

    await storeA.getState().crdt.initialize();

    storeA.getState().setCounter(42);
    storeA.getState().setTitle('world');

    // Flush microtasks; createCrdtSlice persists/export() which triggers update emission.
    await Promise.resolve();

    expect(updatesA.length).toBeGreaterThan(0);
    // For full-state mirroring, use a snapshot (an incremental update may contain only
    // part of the state, depending on what changed last).
    const snapshot = docA.export({mode: 'snapshot'});
    expect(snapshot.byteLength).toBeGreaterThan(0);

    const docB = new LoroDoc();
    const storeB = createStore<AppState>()((set, get, api) =>
      Object.assign(
        {
          counter: 0,
          title: 'init',
          setCounter: (value: number) => set({counter: value}),
          setTitle: (value: string) => set({title: value}),
        },
        createCrdtSlice<AppState>({
          doc: docB,
          mirrors: {
            shared: {
              schema: sharedValueSchema,
              select: (s) => ({counter: s.counter, title: s.title}),
              apply: (value) =>
                set({
                  counter: (value as any).counter,
                  title: (value as any).title,
                }),
            },
          },
        })(set as any, get as any, api as any),
      ),
    );

    await storeB.getState().crdt.initialize();

    // Simulate remote state arriving: import into docB, which should drive mirror->store.
    docB.import(snapshot);
    await Promise.resolve();

    expect(storeB.getState().counter).toBe(42);
    expect(storeB.getState().title).toBe('world');

    unsubA();
  });
});
