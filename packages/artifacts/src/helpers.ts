import {ArtifactEntryType} from '.';

/**
 * Normalizes artifact ordering against the current registry contents.
 *
 * The returned order:
 * - drops unknown artifact ids
 * - removes duplicates while keeping first occurrence order
 * - appends any registered artifacts that were missing from the input order
 *
 * This is useful when reconciling persisted ordering with a newer artifact set
 * or when merging registry updates from another slice.
 *
 * @param itemsById - Current artifact registry keyed by artifact id.
 * @param order - Proposed artifact order, which may contain stale or duplicate ids.
 * @returns A stable artifact order containing each known artifact exactly once.
 */
export function normalizeOrder(
  itemsById: Record<string, ArtifactEntryType>,
  order: string[],
): string[] {
  const seen = new Set<string>();
  const normalized = order.filter((id) => {
    if (!(id in itemsById) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  for (const id of Object.keys(itemsById)) {
    if (!seen.has(id)) {
      normalized.push(id);
    }
  }
  return normalized;
}
