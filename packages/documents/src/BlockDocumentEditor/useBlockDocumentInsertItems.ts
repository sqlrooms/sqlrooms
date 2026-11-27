import {useMemo} from 'react';
import {useBlockDocumentStatefulBlockTypes} from '../BlockDocumentStatefulBlockRendererContext';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';
import {
  type BlockDocumentInsertItem,
  createStatefulBlockInsertItems,
} from './BlockDocumentInsertItems';

/**
 * Returns the editor's `insertItems` followed by items for the registered
 * stateful block types.
 */
export function useBlockDocumentInsertItems(): BlockDocumentInsertItem[] {
  const {insertItems} = useBlockDocumentEditorContext();
  const statefulBlockTypes = useBlockDocumentStatefulBlockTypes();
  return useMemo(
    () => [
      ...insertItems,
      ...createStatefulBlockInsertItems(statefulBlockTypes),
    ],
    [insertItems, statefulBlockTypes],
  );
}
