import {createPersistHelpers} from '@sqlrooms/room-store';
import type {z} from 'zod';

const AI_CONFIG_KEYS = new Set(['ai', 'aiSettings', 'artifactAi']);

/**
 * Preserve dormant embedded configuration across external-mode saves without
 * installing config-only AI slices in the live store. Storage and hydration
 * failure protection remain owned by the existing DuckDB persistence adapter.
 */
export function createCliPersistence<T extends Record<string, z.ZodType>>(
  schemas: T,
  external: boolean,
) {
  const active = createPersistHelpers(
    Object.fromEntries(
      Object.entries(schemas).filter(
        ([key]) => !external || !AI_CONFIG_KEYS.has(key),
      ),
    ),
  );
  let dormant: Record<string, unknown> = {};
  return {
    partialize: (state: unknown) => ({...dormant, ...active.partialize(state)}),
    merge: (persisted: Record<string, unknown>, current: unknown) => {
      if (external) {
        const next: Record<string, unknown> = {};
        for (const key of AI_CONFIG_KEYS) {
          if (persisted[key] !== undefined) {
            schemas[key]!.parse(persisted[key]);
            next[key] = persisted[key];
          }
        }
        dormant = next;
      }
      return active.merge(persisted, current);
    },
  };
}
