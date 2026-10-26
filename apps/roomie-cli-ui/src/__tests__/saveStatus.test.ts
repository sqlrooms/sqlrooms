import {expect, it} from '@jest/globals';
import {createPersistenceController} from '@sqlrooms/room-store';
import {createRoomieSaveStatus} from '../saveStatus';

it('reports preference save failures and clears them only after a successful retry', async () => {
  let fail = true;
  const content = createPersistenceController<string>({
    adapter: {load: async () => null, save: async () => {}},
  });
  const view = createPersistenceController<string>({
    adapter: {
      load: async () => null,
      save: async () => {
        if (fail) throw new Error('Quota exceeded');
      },
    },
  });
  const status = createRoomieSaveStatus(content);
  const observed: ReturnType<typeof status.getState>[] = [];
  const unsubscribe = status.subscribe((state) => observed.push(state));
  status.setView(view);
  view.setSnapshot('preferences');
  await expect(view.flush()).rejects.toThrow('Quota exceeded');
  expect(content.getState().dirty).toBe(false);
  expect(status.getState()).toMatchObject({
    dirty: true,
    saving: false,
    error: expect.any(Error),
  });
  expect(observed.some((state) => Boolean(state.error))).toBe(true);
  fail = false;
  await view.flush();
  expect(status.getState()).toMatchObject({
    dirty: false,
    saving: false,
    error: null,
  });
  unsubscribe();
});
