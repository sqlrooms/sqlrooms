import type {Editor} from '@tiptap/react';
import {createContext, useContext} from 'react';

export type MarkdownDocumentEditorContextValue = {
  editor: Editor | null;
  value: string;
  onChange: (value: string) => void;
  sourcePanelOpen: boolean;
  setSourcePanelOpen: (open: boolean) => void;
  readOnly: boolean;
};

export const MarkdownDocumentEditorContext =
  createContext<MarkdownDocumentEditorContextValue | null>(null);

export function useMarkdownDocumentEditorContext() {
  const context = useContext(MarkdownDocumentEditorContext);
  if (!context) {
    throw new Error(
      'MarkdownDocumentEditor compound components must be used within MarkdownDocumentEditor.Root',
    );
  }
  return context;
}
