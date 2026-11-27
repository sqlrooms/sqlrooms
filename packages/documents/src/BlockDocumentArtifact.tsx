import React, {useCallback, useEffect} from 'react';
import type {Editor} from '@tiptap/react';
import {useShallow} from 'zustand/react/shallow';
import {BlockDocumentEditor} from './BlockDocumentEditor';
import type {BlockDocumentInsertItem} from './BlockDocumentEditor/BlockDocumentInsertItems';
import type {BlockDocumentContent} from './BlockDocumentSliceConfig';
import type {BlockDocumentMutationMetadata} from './BlockDocumentsSlice';
import {createEmptyBlockDocumentContent} from './BlockDocumentSliceConfig';
import {useStoreWithBlockDocuments} from './useStoreWithBlockDocuments';

export type BlockDocumentArtifactProps = {
  artifactId: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  onEditorReady?: (editor: Editor) => void;
  /** Blocks offered for insertion; see `BlockDocumentEditorRootProps`. */
  insertItems?: readonly BlockDocumentInsertItem[];
  /**
   * Editor surfaces to render, e.g. `<BlockDocumentEditor.Toolbar />` and
   * `<BlockDocumentEditor.Content />`. Defaults to just the content.
   */
  children?: React.ReactNode;
};

export const BlockDocumentArtifact: React.FC<BlockDocumentArtifactProps> = ({
  artifactId,
  title = 'Untitled',
  onTitleChange,
  onEditorReady,
  insertItems,
  children,
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
      title={title}
      onTitleChange={onTitleChange}
      onEditorReady={onEditorReady}
      insertItems={insertItems}
    >
      {children ?? <BlockDocumentEditor.Content />}
    </BlockDocumentEditor>
  );
};
