import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {DeckMapBlockRenderer} from '@sqlrooms/deck';

export const WorksheetMapBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  caption,
}: BlockDocumentStatefulBlockRendererProps) => {
  if (!blockInstanceId || blockType !== 'map') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  return (
    <DeckMapBlockRenderer
      mapId={blockInstanceId}
      title={title}
      caption={caption}
    />
  );
};
