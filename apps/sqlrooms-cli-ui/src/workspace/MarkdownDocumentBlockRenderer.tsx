import {
  MarkdownDocument,
  type BlockDocumentStatefulBlockRendererProps,
} from '@sqlrooms/documents';
import {useEffect} from 'react';
import {useRoomStore} from '../roomStoreHooks';

export const MarkdownDocumentBlockRenderer = ({
  blockInstanceId,
  blockType,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  const ensureDocument = useRoomStore(
    (state) => state.markdownDocuments.ensureDocument,
  );

  useEffect(() => {
    if (blockType === 'markdown-document' && blockInstanceId) {
      ensureDocument(blockInstanceId);
    }
  }, [blockInstanceId, blockType, ensureDocument]);

  if (!blockInstanceId || blockType !== 'markdown-document') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  return (
    <div className="flex h-[560px] min-h-[420px] flex-col">
      {caption ? (
        <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
          {caption}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <MarkdownDocument artifactId={blockInstanceId} />
      </div>
    </div>
  );
};
