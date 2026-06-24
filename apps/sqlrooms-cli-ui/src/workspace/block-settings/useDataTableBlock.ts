import {useMemo} from 'react';
import {useRoomStore} from '../../store';
import type {BlockDocumentStatefulBlock} from '@sqlrooms/documents';

/**
 * Hook to get a data table block from a block document.
 * Subscribes to the artifact so component re-renders when the block changes.
 *
 * @param documentId - The document ID (can be undefined)
 * @param blockId - The block ID (can be undefined)
 * @returns The data table block if found, otherwise undefined
 */
export function useDataTableBlock(
  documentId: string | undefined,
  blockId: string | undefined,
): BlockDocumentStatefulBlock | undefined {
  // Select the artifact directly so we re-render when it changes
  const artifact = useRoomStore((state) =>
    documentId ? state.blockDocuments.config.artifacts[documentId] : undefined,
  );

  // Get blocks and find the data table block - use artifact as dependency
  const dataTableBlock = useMemo(() => {
    if (!artifact || !documentId || !blockId) return undefined;

    // Call getBlocks directly to avoid unnecessary selector dependency
    const state = useRoomStore.getState();
    const blocks = state.blockDocuments.getBlocks(documentId);

    return blocks.find(
      (block): block is BlockDocumentStatefulBlock =>
        block.id === blockId &&
        block.type === 'statefulBlock' &&
        block.blockType === 'data-table',
    );
  }, [artifact, documentId, blockId]);

  return dataTableBlock;
}
