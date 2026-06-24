import {useMemo} from 'react';
import {useRoomStore} from '../../store';
import type {BlockDocumentChartBlock} from '@sqlrooms/documents';

/**
 * Hook to get a chart block from a block document.
 * Subscribes to the artifact so component re-renders when the block changes.
 *
 * @param documentId - The document ID (can be undefined)
 * @param blockId - The block ID (can be undefined)
 * @returns The chart block if found, otherwise undefined
 */
export function useChartBlock(
  documentId: string | undefined,
  blockId: string | undefined,
): BlockDocumentChartBlock | undefined {
  // Select the artifact directly so we re-render when it changes
  const artifact = useRoomStore((state) =>
    documentId ? state.blockDocuments.config.artifacts[documentId] : undefined,
  );

  // Get blocks and find the chart block - use artifact as dependency
  const chartBlock = useMemo(() => {
    if (!artifact || !documentId || !blockId) return undefined;

    // Call getBlocks directly to avoid unnecessary selector dependency
    const state = useRoomStore.getState();
    const blocks = state.blockDocuments.getBlocks(documentId);

    return blocks.find(
      (block): block is BlockDocumentChartBlock =>
        block.id === blockId && block.type === 'chart',
    );
  }, [artifact, documentId, blockId]);

  return chartBlock;
}
