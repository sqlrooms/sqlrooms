import type {FC} from 'react';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {DeckMapBlockRenderer} from '@sqlrooms/deck';

/**
 * Renders a worksheet map stateful block through the Deck embeddable map surface.
 *
 * Map blocks use TipTap's native node selection (no custom SelectablePanelWrapper).
 *
 * @param props - Stateful block renderer props, including the map block instance
 * ID, block type, title, and caption from the worksheet document.
 * @returns The configured Deck map block renderer, or an unsupported block message.
 */
export const WorksheetMapBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = ({blockInstanceId, blockType, title, caption}) => {
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
