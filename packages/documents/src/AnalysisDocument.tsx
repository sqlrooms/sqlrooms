import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {AnalysisDocumentEditor} from './AnalysisDocumentEditor';
import type {AnalysisDocumentContent} from './AnalysisDocumentSliceConfig';
import type {AnalysisDocumentMutationMetadata} from './AnalysisDocumentsSlice';
import {createEmptyAnalysisDocumentContent} from './AnalysisDocumentSliceConfig';
import {useStoreWithAnalysisDocuments} from './useStoreWithAnalysisDocuments';

export const AnalysisDocumentArtifact: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {analysis, ensureAnalysis, setContent, syncMetadata} =
    useStoreWithAnalysisDocuments(
      useShallow((state) => ({
        analysis: state.analysisDocuments.config.artifacts[artifactId],
        ensureAnalysis: state.analysisDocuments.ensureAnalysis,
        setContent: state.analysisDocuments.setContent,
        syncMetadata: state.analysisDocuments.syncMetadata[artifactId],
      })),
    );

  useEffect(() => {
    if (!analysis) {
      ensureAnalysis(artifactId);
    }
  }, [artifactId, analysis, ensureAnalysis]);

  const handleChange = useCallback(
    (
      content: AnalysisDocumentContent,
      metadata?: AnalysisDocumentMutationMetadata,
    ) => {
      setContent(artifactId, content, metadata);
    },
    [artifactId, setContent],
  );

  return (
    <AnalysisDocumentEditor
      analysisId={artifactId}
      value={analysis?.content ?? createEmptyAnalysisDocumentContent()}
      assets={analysis?.assets}
      syncRevision={syncMetadata?.revision}
      syncSourceId={syncMetadata?.sourceId}
      onChange={handleChange}
    >
      <AnalysisDocumentEditor.Toolbar />
      <AnalysisDocumentEditor.Content />
    </AnalysisDocumentEditor>
  );
};
