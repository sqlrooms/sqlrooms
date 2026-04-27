import {ArtifactMetadataType} from '.';

/**
 * Normalizes artifact ordering against the current registry contents.
 *
 * The returned order:
 * - drops unknown artifact ids
 * - removes duplicates while keeping the first occurrence
 * - appends any registered artifacts that were missing from the input order
 *
 * This is useful when reconciling persisted ordering with a newer artifact set
 * or when merging registry updates from another slice.
 *
 * @param artifactsById - Current artifact registry keyed by artifact id.
 * @param artifactOrder - Proposed artifact order, which may contain stale or duplicate ids.
 * @returns A stable artifact order containing each known artifact exactly once.
 */
export function normalizeOrder(
  artifactsById: Record<string, ArtifactMetadataType>,
  artifactOrder: string[],
): string[] {
  const seen = new Set<string>();
  const normalized = artifactOrder.filter((id) => {
    if (!(id in artifactsById) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  for (const id of Object.keys(artifactsById)) {
    if (!seen.has(id)) {
      normalized.push(id);
    }
  }
  return normalized;
}
