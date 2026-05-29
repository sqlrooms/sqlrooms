import {cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import type {FC} from 'react';
import {useState} from 'react';
import {BlocksDocumentBlockControls} from './BlocksDocumentBlockControls';
import {useBlocksDocumentEditorContext} from './BlocksDocumentEditorContext';

export type BlocksDocumentEditorContentProps = {
  className?: string;
};

export const BlocksDocumentEditorContent: FC<
  BlocksDocumentEditorContentProps
> = ({className}) => {
  const {editor} = useBlocksDocumentEditorContext();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  return (
    <div
      ref={setScrollElement}
      className={cn('relative h-full min-h-0 flex-1 overflow-auto', className)}
    >
      <EditorContent editor={editor} className="min-h-full" />
      <BlocksDocumentBlockControls scrollElement={scrollElement} />
    </div>
  );
};
