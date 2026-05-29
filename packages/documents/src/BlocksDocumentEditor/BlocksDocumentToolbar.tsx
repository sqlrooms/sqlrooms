import {Button, cn} from '@sqlrooms/ui';
import {
  BarChart3Icon,
  ImageIcon,
  PilcrowIcon,
} from 'lucide-react';
import type {FC} from 'react';
import {RichToolbar} from '../MarkdownDocumentEditor/RichToolbar';
import {useBlocksDocumentEditorContext} from './BlocksDocumentEditorContext';

export type BlocksDocumentToolbarProps = {
  className?: string;
};

export const BlocksDocumentToolbar: FC<BlocksDocumentToolbarProps> = ({
  className,
}) => {
  const {editor, readOnly, generateBlockId} =
    useBlocksDocumentEditorContext();

  const insertAtomBlock = (type: string, attrs: Record<string, unknown>) => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type,
        attrs: {id: generateBlockId(), ...attrs},
      })
      .run();
  };

  return (
    <div
      className={cn(
        'border-border flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2',
        className,
      )}
    >
      <RichToolbar editor={editor} disabled={readOnly} />
      <div className="bg-border mx-1 h-6 w-px" />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={!editor || readOnly}
        title="Insert paragraph"
        aria-label="Insert paragraph"
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: 'paragraph',
              attrs: {id: generateBlockId()},
            })
            .run()
        }
      >
        <PilcrowIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={!editor || readOnly}
        title="Insert image block"
        aria-label="Insert image block"
        onClick={() =>
          insertAtomBlock('blocksDocumentImage', {assetId: '', caption: ''})
        }
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={!editor || readOnly}
        title="Insert chart block"
        aria-label="Insert chart block"
        onClick={() =>
          insertAtomBlock('blocksDocumentChart', {
            tableName: '',
            config: {},
            caption: '',
          })
        }
      >
        <BarChart3Icon className="h-4 w-4" />
      </Button>
    </div>
  );
};
