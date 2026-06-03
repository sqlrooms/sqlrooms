import {describe, expect, it} from '@jest/globals';
import {createPersistenceController} from '../src/PersistenceController';

function nextMacrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
    const saved: {snapshot: string; reason: string | undefined}[] = [];
    let releaseFirstSave: (() => void) | undefined;
    let resolveFirstSaveStarted: (() => void) | undefined;
    const firstSaveStarted = new Promise<void>((resolve) => {
      resolveFirstSaveStarted = resolve;
    });
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot, metadata) => {
          saved.push({snapshot, reason: metadata?.reason});
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
    const flushPromise = controller.saveNow('autosave');
    await firstSaveStarted;
    controller.setSnapshot('second', 'setItem');
    const coalescedFlushPromise = controller.flush('flush');
    releaseFirstSave?.();
    await flushPromise;
    await coalescedFlushPromise;

    expect(saved).toEqual([
      {snapshot: 'first', reason: 'autosave'},
      {snapshot: 'second', reason: 'flush'},
    ]);
    expect(controller.getState()).toMatchObject({
      dirty: false,
      saving: false,
      lastSaveReason: 'flush',
    });
  });

  it('autosaves dirty snapshots after the configured delay', async () => {
    const saved: string[] = [];
    let resolveSaved: (() => void) | undefined;
    const savedSnapshot = new Promise<void>((resolve) => {
      resolveSaved = resolve;
    });
    const controller = createPersistenceController<string>({
      autosaveDelayMs: 1,
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
          resolveSaved?.();
        },
      },
    });

    controller.setSnapshot('autosaved', 'setItem');
    await savedSnapshot;
    await Promise.resolve();

    expect(saved).toEqual(['autosaved']);
    expect(controller.getState().dirty).toBe(false);
  });

  it('reschedules autosave when the outermost pause exits', async () => {
    const saved: string[] = [];
    let resolveSaved: (() => void) | undefined;
    const savedSnapshot = new Promise<void>((resolve) => {
      resolveSaved = resolve;
    });
    const controller = createPersistenceController<string>({
      autosaveDelayMs: 0,
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
          resolveSaved?.();
        },
      },
    });

    controller.setSnapshot('before-pause', 'setItem');
    await controller.pause(async () => {
      await nextMacrotask();
      expect(saved).toEqual([]);
    });

    await savedSnapshot;
    await Promise.resolve();

    expect(saved).toEqual(['before-pause']);
    expect(controller.getState().dirty).toBe(false);
  });

  it('surfaces an error when markDirty has no snapshot source', async () => {
    const saved: string[] = [];
    const controller = createPersistenceController<string>({
      adapter: {
        load: async () => null,
        save: async (snapshot) => {
          saved.push(snapshot);
        },
      },
    });

    controller.markDirty('manual');
    await controller.flush();

    expect(saved).toEqual([]);
    expect(controller.getState().dirty).toBe(false);
    expect(controller.getState().error).toBeInstanceOf(Error);
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
