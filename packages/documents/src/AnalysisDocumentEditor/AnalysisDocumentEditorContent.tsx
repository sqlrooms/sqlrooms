import {cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import type {FC} from 'react';
import {useState} from 'react';
import {AnalysisBlockControls} from './AnalysisBlockControls';
import {useAnalysisDocumentEditorContext} from './AnalysisDocumentEditorContext';

export type AnalysisDocumentEditorContentProps = {
  className?: string;
};

export const AnalysisDocumentEditorContent: FC<
  AnalysisDocumentEditorContentProps
> = ({className}) => {
  const {editor} = useAnalysisDocumentEditorContext();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  return (
    <div
      ref={setScrollElement}
      className={cn('relative h-full min-h-0 flex-1 overflow-auto', className)}
    >
      <EditorContent editor={editor} className="min-h-full" />
      <AnalysisBlockControls scrollElement={scrollElement} />
    </div>
  );
};
