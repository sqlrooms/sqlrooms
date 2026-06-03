import {describe, expect, it} from '@jest/globals';
import {createPersistenceController} from '../src/PersistenceController';

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createPersistenceController', () => {
  it('hydrates without marking dirty', async () => {
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => '{"title":"Saved"}',
        save: async () => {
          throw new Error('save should not run during hydrate');
        },
      },
    });

    const snapshot = await controller.hydrate();

    expect(snapshot).toBe('{"title":"Saved"}');
    expect(controller.getState()).toMatchObject({
      hydrating: false,
      dirty: false,
      saving: false,
      error: null,
    });
  });

  it('ignores dirty marking while paused', async () => {
    const saved: string[] = [];
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
        },
      },
    });

    await controller.pause(async () => {
      controller.setSnapshot('paused', 'setItem');
      controller.markDirty('manual');
    });
    await controller.flush();

    expect(saved).toEqual([]);
    expect(controller.getState().dirty).toBe(false);
  });

  it('saves dirty snapshots on flush and clears dirty state', async () => {
    const saved: string[] = [];
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
        },
      },
    });

    controller.setSnapshot('next', 'setItem');
    await controller.flush();

    expect(saved).toEqual(['next']);
    expect(controller.getState()).toMatchObject({
      dirty: false,
      saving: false,
      lastSaveReason: 'flush',
    });
    expect(controller.getState().lastSavedAt).toEqual(expect.any(Number));
  });

  it('coalesces in-flight saves and persists the latest pending snapshot', async () => {
    const saved: string[] = [];
    let releaseFirstSave: (() => void) | undefined;
    let resolveFirstSaveStarted: (() => void) | undefined;
    const firstSaveStarted = new Promise<void>((resolve) => {
      resolveFirstSaveStarted = resolve;
    });
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
          resolveFirstSaveStarted?.();
          if (snapshot === 'first') {
            await new Promise<void>((release) => {
              releaseFirstSave = release;
            });
          }
        },
      },
    });

    controller.setSnapshot('first', 'setItem');
    const flushPromise = controller.flush();
    await firstSaveStarted;
    controller.setSnapshot('second', 'setItem');
    releaseFirstSave?.();
    await flushPromise;

    expect(saved).toEqual(['first', 'second']);
    expect(controller.getState()).toMatchObject({
      dirty: false,
      saving: false,
    });
  });

  it('autosaves dirty snapshots after the configured delay', async () => {
    const saved: string[] = [];
    const controller = createPersistenceController<string>({
      autosaveDelayMs: 1,
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
        },
      },
    });

    controller.setSnapshot('autosaved', 'setItem');
    await wait(10);

    expect(saved).toEqual(['autosaved']);
    expect(controller.getState().dirty).toBe(false);
  });

  it('sets an explicit saved snapshot without saving', async () => {
    const saved: string[] = [];
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
        },
      },
    });

    controller.setSnapshot('draft', 'setItem');
    controller.markSnapshotSaved('draft');
    await controller.flush();

    expect(saved).toEqual([]);
    expect(controller.getState().dirty).toBe(false);
  });
});
