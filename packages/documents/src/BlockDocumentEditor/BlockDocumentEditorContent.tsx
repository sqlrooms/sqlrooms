import {cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import type {FC} from 'react';
import {useState} from 'react';
import {BlockDocumentBlockControls} from './BlockDocumentBlockControls';
import {useBlockDocumentEditorContext} from './BlockDocumentEditorContext';

export type BlockDocumentEditorContentProps = {
  className?: string;
};

export const BlockDocumentEditorContent: FC<
  BlockDocumentEditorContentProps
> = ({className}) => {
  const {editor} = useBlockDocumentEditorContext();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  return (
    <div
      ref={setScrollElement}
      className={cn('relative h-full min-h-0 flex-1 overflow-auto', className)}
    >
      <EditorContent editor={editor} className="min-h-full" />
      <BlockDocumentBlockControls scrollElement={scrollElement} />
    </div>
  );
};
