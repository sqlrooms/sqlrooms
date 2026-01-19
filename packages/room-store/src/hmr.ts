import {StoreApi} from 'zustand';

/**
 * Dev-only: HMR store preservation utilities.
 * These are isolated and tree-shakable in production builds.
 *
 * Returns null in production, so all usages should be guarded with:
 * `if (DEV_HMR) { ... }`
 *
 *  The problem this solves is that during hot module replacement (HMR), the
 *  store module would get re-executed,but the closure's store variable would be
 *  undefined, causing the error when components tried to use useRoomStore.
 *
 *  The fix adds three key changes:
 *
 *  1. Creates a persistent registry on the window object that survives hot
 *     reloads. This stores all store instances by unique IDs.
 *  2. Each store creator gets a unique ID. Since the counter resets on hot
 *     reload but stores are created in the same order, the IDs remain
 *     consistent across reloads.
 *  3. Before creating a new store, it checks if one already exists in the
 *     registry from a previous hot reload. If found, it reuses the existing
 *     store, preserving all state and preventing initialization errors.
 *
 *  This ensures that:
 *  - Store state is preserved across hot reloads
 *  - No "Room store not initialized" errors during development
 *  - The store initialization only happens once, not on every hot reload
 *
 */
export const DEV_HMR = (() => {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Only initialize in development mode
  const registry =
    typeof window !== 'undefined'
      ? ((window as any).__SQLROOMS_STORE_REGISTRY__ ??= new Map<
          string,
          StoreApi<any>
        >())
      : new Map<string, StoreApi<any>>();
  let idCounter = 0;

  return {
    nextId: () => `store_${idCounter++}`,
    get: (id: string) => registry.get(id),
    set: (id: string, store: StoreApi<any>) => registry.set(id, store),
  };
})();
