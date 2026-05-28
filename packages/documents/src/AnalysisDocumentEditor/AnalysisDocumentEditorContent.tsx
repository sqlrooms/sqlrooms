import {cn} from '@sqlrooms/ui';
import {EditorContent} from '@tiptap/react';
import type {FC} from 'react';
import {useAnalysisDocumentEditorContext} from './AnalysisDocumentEditorContext';

export type AnalysisDocumentEditorContentProps = {
  className?: string;
};

export const AnalysisDocumentEditorContent: FC<
  AnalysisDocumentEditorContentProps
> = ({className}) => {
  const {editor} = useAnalysisDocumentEditorContext();

  return (
    <EditorContent
      editor={editor}
      className={cn('h-full min-h-0 flex-1 overflow-auto', className)}
    />
  );
};
