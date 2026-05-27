import {arrayMove} from '@dnd-kit/sortable';
import type {ContextSelectorItem} from './types';

export function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export function toggleContextSelectorItem(
  selectedIds: string[],
  itemId: string,
) {
  return selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];
}

export function promoteContextSelectorItem(
  selectedIds: string[],
  itemId: string,
) {
  return [itemId, ...selectedIds.filter((id) => id !== itemId)];
}

export function reorderContextSelectorItems(
  selectedIds: string[],
  activeId: string,
  overId: string,
) {
  const oldIndex = selectedIds.indexOf(activeId);
  const newIndex = selectedIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return selectedIds;
  }
  return arrayMove(selectedIds, oldIndex, newIndex);
}

export function getKnownItems(items: ContextSelectorItem[], ids: string[]) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => itemsById.get(id))
    .filter(Boolean) as ContextSelectorItem[];
}

export function defaultTypeLabel(item: ContextSelectorItem) {
  return item.type ?? item.kind;
}

export function getGroupLabel(kind: string): string {
  if (kind === 'artifact') return 'Artifacts';
  if (kind === 'table') return 'Tables';
  return 'Others';
}
