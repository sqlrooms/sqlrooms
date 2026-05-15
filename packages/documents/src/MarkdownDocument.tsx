import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {MarkdownDocumentEditor} from './MarkdownDocumentEditor';
import {useStoreWithDocuments} from './useStoreWithDocuments';

export const MarkdownDocument: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {document, ensureDocument, setMarkdown} = useStoreWithDocuments(
    useShallow((state) => ({
      document: state.documents.config.artifacts[artifactId],
      ensureDocument: state.documents.ensureDocument,
      setMarkdown: state.documents.setMarkdown,
    })),
  );

  useEffect(() => {
    if (!document) {
      ensureDocument(artifactId);
    }
  }, [artifactId, document, ensureDocument]);

  const handleChange = useCallback(
    (markdown: string) => {
      setMarkdown(artifactId, markdown);
    },
    [artifactId, setMarkdown],
  );

  return (
    <MarkdownDocumentEditor
      value={document?.markdown ?? ''}
      onChange={handleChange}
    >
      <MarkdownDocumentEditor.Toolbar />
      <MarkdownDocumentEditor.Content />
    </MarkdownDocumentEditor>
  );
};
