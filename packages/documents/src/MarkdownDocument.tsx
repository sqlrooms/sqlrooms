import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {MarkdownDocumentEditor} from './MarkdownDocumentEditor';
import {useStoreWithMarkdownDocuments} from './useStoreWithMarkdownDocuments';

export const MarkdownDocument: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {document, ensureDocument, setMarkdown} = useStoreWithMarkdownDocuments(
    useShallow((state) => ({
      document: state.markdownDocuments.config.artifacts[artifactId],
      ensureDocument: state.markdownDocuments.ensureDocument,
      setMarkdown: state.markdownDocuments.setMarkdown,
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
