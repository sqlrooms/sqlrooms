import {
  getRenderableDependencyEdges,
  type Edge,
  type Sheet,
} from '@sqlrooms/cells';

export function getRenderableEdges(sheet: Sheet | undefined): Edge[] {
  if (!sheet) return [];
  return getRenderableDependencyEdges(sheet);
}
