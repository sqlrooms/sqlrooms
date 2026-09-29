/** @jest-environment jsdom */
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {createDuckDbPersistStorage} from '../src/createDuckDbPersistStorage';

function connector() {
  return {
    query: jest.fn<(sql: string) => Promise<unknown>>(async () => ({
      toArray: () => [{payload_json: '{}'}],
    })),
  };
}

describe('DuckDB workspace persistence', () => {
  let windowEvents: ReturnType<
    typeof jest.spyOn<typeof window, 'addEventListener'>
  >;
  let documentEvents: ReturnType<
    typeof jest.spyOn<typeof document, 'addEventListener'>
  >;

  beforeEach(() => {
    jest.useFakeTimers();
    windowEvents = jest.spyOn(window, 'addEventListener');
    documentEvents = jest.spyOn(document, 'addEventListener');
  });

  afterEach(() => {
    for (const [type, listener] of windowEvents.mock.calls)
      window.removeEventListener(type, listener);
    for (const [type, listener] of documentEvents.mock.calls)
      document.removeEventListener(type, listener);
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['load', 'save', 'remove'] as const)(
    'retries failed initialization on the next %s and caches success',
    async (operation) => {
      const db = connector();
      db.query.mockRejectedValueOnce(new Error('Connection interrupted'));
      const storage = createDuckDbPersistStorage(db);
      if (operation === 'save') storage.completeHydration({edited: true});
      const run = () =>
        operation === 'load'
          ? storage.getItem('workspace')
          : operation === 'save'
            ? storage.flush()
            : storage.removeItem('workspace');
      await expect(run()).rejects.toThrow('Connection interrupted');
      await run();
      if (operation === 'save') {
        expect(
          db.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT')),
        ).toHaveLength(1);
      }
      await storage.getItem('workspace');
      await storage.removeItem('workspace');
      expect(
        db.query.mock.calls.filter(([sql]) => sql.startsWith('CREATE TABLE')),
      ).toHaveLength(2);
    },
  );

  it('warns while dirty or saving and stops warning after the awaited write', async () => {
    const db = connector();
    const storage = createDuckDbPersistStorage(db);
    await storage.getItem('workspace');
    storage.completeHydration({});
    const unload = () => {
      const event = new Event('beforeunload', {cancelable: true});
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    let finishWrite!: () => void;
    db.query.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    await storage.setItem('workspace', {state: {edited: true}});
    expect(unload()).toBe(true);
    const flushed = storage.flush();
    // Allow the controller to resolve the snapshot and start the SQL write.
    await Promise.resolve();
    await Promise.resolve();
    expect(storage.controller.getState().saving).toBe(true);
    expect(unload()).toBe(true);
    finishWrite();
    await flushed;
    expect(storage.controller.getState()).toMatchObject({
      dirty: false,
      saving: false,
      error: null,
    });
    expect(unload()).toBe(false);
  });

  it('records a failed best-effort hidden-page flush and permits an explicit retry', async () => {
    const db = connector();
    const storage = createDuckDbPersistStorage(db);
    await storage.getItem('workspace');
    storage.completeHydration({});
    await storage.setItem('workspace', {state: {edited: true}});
    db.query.mockRejectedValueOnce(new Error('Write failed'));
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await expect(storage.flush()).rejects.toThrow('Write failed');
    expect(storage.controller.getState().dirty).toBe(true);
    await storage.flush();
    expect(storage.controller.getState()).toMatchObject({
      dirty: false,
      error: null,
    });
  });

  it('does not write before hydration is successfully completed', async () => {
    const db = connector();
    const storage = createDuckDbPersistStorage(db);
    await storage.getItem('workspace');
    await storage.setItem('workspace', {state: {edited: true}});
    await storage.flush();
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(
      false,
    );
  });
});
