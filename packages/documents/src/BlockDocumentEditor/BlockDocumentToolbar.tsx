import {Button, cn} from '@sqlrooms/ui';
import {type FC, useMemo} from 'react';
import {RichToolbar} from '../MarkdownDocumentEditor/RichToolbar';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';
import {insertBlockDocumentItem} from './BlockDocumentInsertItems';
import {useBlockDocumentInsertItems} from './useBlockDocumentInsertItems';

/** Ids of the insert items the toolbar shows as buttons, in order. */
const TOOLBAR_INSERT_ITEM_IDS = ['paragraph', 'image', 'chart'];

export type BlockDocumentToolbarProps = {
  className?: string;
};

/**
 * Formatting toolbar plus insert buttons for the Paragraph, Image and Chart
 * items of the editor's `insertItems`. A button is left out when its item is
 * missing, so Image only appears when the host provides an `'image'` item.
 */
export const BlockDocumentToolbar: FC<BlockDocumentToolbarProps> = ({
  className,
}) => {
  const {editor, readOnly, generateBlockId} = useBlockDocumentEditorContext();
  const insertItems = useBlockDocumentInsertItems();
  const toolbarItems = useMemo(
    () =>
      TOOLBAR_INSERT_ITEM_IDS.flatMap((id) => {
        const item = insertItems.find((candidate) => candidate.id === id);
        return item ? [item] : [];
      }),
    [insertItems],
  );

  return (
    <div
      className={cn(
        'border-border flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2',
        className,
      )}
    >
      <RichToolbar editor={editor} disabled={readOnly} />
      <div className="bg-border mx-1 h-6 w-px" />
      {toolbarItems.map((item) => {
        const title = `Insert ${item.label.toLowerCase()}`;
        return (
          <Button
            key={item.id}
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!editor || readOnly}
            title={title}
            aria-label={title}
            onClick={() => {
              if (!editor) return;
              insertBlockDocumentItem({
                editor,
                item,
                nodeId: generateBlockId(),
                target: {kind: 'selection'},
              });
            }}
          >
            <item.icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
};
