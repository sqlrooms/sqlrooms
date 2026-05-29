import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {BlockDocumentEditor} from './BlockDocumentEditor';
import type {BlockDocumentContent} from './BlockDocumentSliceConfig';
import type {BlockDocumentMutationMetadata} from './BlockDocumentsSlice';
import {createEmptyBlockDocumentContent} from './BlockDocumentSliceConfig';
import {useStoreWithBlockDocuments} from './useStoreWithBlockDocuments';

export const BlockDocumentArtifact: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {blockDocument, ensureBlockDocument, setContent, syncMetadata} =
    useStoreWithBlockDocuments(
      useShallow((state) => ({
        blockDocument: state.blockDocuments.config.artifacts[artifactId],
        ensureBlockDocument: state.blockDocuments.ensureBlockDocument,
        setContent: state.blockDocuments.setContent,
        syncMetadata: state.blockDocuments.syncMetadata[artifactId],
      })),
    );

  useEffect(() => {
    if (!blockDocument) {
      ensureBlockDocument(artifactId);
    }
  }, [artifactId, blockDocument, ensureBlockDocument]);

  const handleChange = useCallback(
    (
      content: BlockDocumentContent,
      metadata?: BlockDocumentMutationMetadata,
    ) => {
      setContent(artifactId, content, metadata);
    },
    [artifactId, setContent],
  );

  return (
    <BlockDocumentEditor
      documentId={artifactId}
      value={blockDocument?.content ?? createEmptyBlockDocumentContent()}
      assets={blockDocument?.assets}
      syncRevision={syncMetadata?.revision}
      syncSourceId={syncMetadata?.sourceId}
      onChange={handleChange}
    >
      <BlockDocumentEditor.Content />
    </BlockDocumentEditor>
  );
};
