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
    <div className="relative h-full min-h-0 flex-1">
      <EditorContent
        ref={setScrollElement}
        editor={editor}
        className={cn('h-full min-h-0 overflow-auto', className)}
      />
      <AnalysisBlockControls scrollElement={scrollElement} />
    </div>
  );
};
