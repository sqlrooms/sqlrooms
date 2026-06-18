import type {AgentSnapshot} from '../types';

/**
 * Clones a serializable agent snapshot when it fits within the byte limit.
 *
 * Returns `undefined` for oversized or unserializable snapshots so stale or
 * imported debug data cannot enter live devtools state.
 */
export function cloneBoundedAgentSnapshot(
  snapshot: AgentSnapshot,
  maxBytes: number,
): AgentSnapshot | undefined {
  try {
    const serialized = JSON.stringify(snapshot);
    const byteLength = new TextEncoder().encode(serialized).byteLength;
    if (byteLength > maxBytes) {
      return undefined;
    }
    return JSON.parse(serialized) as AgentSnapshot;
  } catch {
    return undefined;
  }
}
