import {
  getRenderableDependencyEdges,
  type Edge,
  type CellArtifactRuntime,
} from '@sqlrooms/cells';

export function getRenderableEdges(
  artifact: CellArtifactRuntime | undefined,
): Edge[] {
  if (!artifact) return [];
  return getRenderableDependencyEdges(artifact);
}
