import React, {useCallback, useEffect} from 'react';
import {MarkdownDocumentEditor} from './MarkdownDocumentEditor';
import {useStoreWithMarkdownDocuments} from './useStoreWithMarkdownDocuments';

export const MarkdownDocument: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const document = useStoreWithMarkdownDocuments(
    (state) => state.markdownDocuments.config.artifacts[artifactId],
  );
  const ensureDocument = useStoreWithMarkdownDocuments(
    (state) => state.markdownDocuments.ensureDocument,
  );
  const setMarkdown = useStoreWithMarkdownDocuments(
    (state) => state.markdownDocuments.setMarkdown,
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
