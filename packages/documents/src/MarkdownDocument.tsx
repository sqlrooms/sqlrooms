import React, {useEffect} from 'react';
import {MilkdownMarkdownDocumentEditor} from './MilkdownMarkdownDocumentEditor';
import {useStoreWithDocuments} from './useStoreWithDocuments';

export const MarkdownDocument: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const document = useStoreWithDocuments(
    (state) => state.documents.config.artifacts[artifactId],
  );
  const ensureDocument = useStoreWithDocuments(
    (state) => state.documents.ensureDocument,
  );
  const setMarkdown = useStoreWithDocuments(
    (state) => state.documents.setMarkdown,
  );

  useEffect(() => {
    if (!document) {
      ensureDocument(artifactId);
    }
  }, [artifactId, document, ensureDocument]);

  return (
    <MilkdownMarkdownDocumentEditor
      value={document?.markdown ?? ''}
      onChange={(markdown) => setMarkdown(artifactId, markdown)}
    />
  );
};
