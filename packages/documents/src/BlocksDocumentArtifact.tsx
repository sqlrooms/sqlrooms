import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {BlocksDocumentEditor} from './BlocksDocumentEditor';
import type {BlocksDocumentContent} from './BlocksDocumentSliceConfig';
import type {BlocksDocumentMutationMetadata} from './BlocksDocumentsSlice';
import {createEmptyBlocksDocumentContent} from './BlocksDocumentSliceConfig';
import {useStoreWithBlocksDocuments} from './useStoreWithBlocksDocuments';

export const BlocksDocumentArtifact: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {blocksDocument, ensureBlocksDocument, setContent, syncMetadata} =
    useStoreWithBlocksDocuments(
      useShallow((state) => ({
        blocksDocument: state.blocksDocuments.config.artifacts[artifactId],
        ensureBlocksDocument: state.blocksDocuments.ensureBlocksDocument,
        setContent: state.blocksDocuments.setContent,
        syncMetadata: state.blocksDocuments.syncMetadata[artifactId],
      })),
    );

  useEffect(() => {
    if (!blocksDocument) {
      ensureBlocksDocument(artifactId);
    }
  }, [artifactId, blocksDocument, ensureBlocksDocument]);

  const handleChange = useCallback(
    (
      content: BlocksDocumentContent,
      metadata?: BlocksDocumentMutationMetadata,
    ) => {
      setContent(artifactId, content, metadata);
    },
    [artifactId, setContent],
  );

  return (
    <BlocksDocumentEditor
      documentId={artifactId}
      value={blocksDocument?.content ?? createEmptyBlocksDocumentContent()}
      assets={blocksDocument?.assets}
      syncRevision={syncMetadata?.revision}
      syncSourceId={syncMetadata?.sourceId}
      onChange={handleChange}
    >
      <BlocksDocumentEditor.Toolbar />
      <BlocksDocumentEditor.Content />
    </BlocksDocumentEditor>
  );
};
