import type {PersistenceController} from '@sqlrooms/room-store';

type Source = Pick<PersistenceController<string>, 'getState' | 'subscribe'>;

/** Observe content and browser preferences together, including failed autosaves. */
export function createRoomieSaveStatus(content: Source) {
  let view: Source | undefined;
  let unsubscribeView: (() => void) | undefined;
  const getState = () => {
    const a = content.getState();
    const b = view?.getState();
    return {
      dirty: a.dirty || Boolean(b?.dirty),
      saving: a.saving || Boolean(b?.saving),
      error: a.error ?? b?.error ?? null,
      lastSavedAt: Math.max(a.lastSavedAt ?? 0, b?.lastSavedAt ?? 0) || null,
    };
  };
  const listeners = new Set<(state: ReturnType<typeof getState>) => void>();
  const emit = () => listeners.forEach((listener) => listener(getState()));
  content.subscribe(emit);
  return {
    getState,
    subscribe(listener: (state: ReturnType<typeof getState>) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setView(source: Source) {
      unsubscribeView?.();
      view = source;
      unsubscribeView = source.subscribe(emit);
      emit();
    },
  };
}
