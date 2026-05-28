import React, {useCallback, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {AnalysisDocumentEditor} from './AnalysisDocumentEditor';
import type {AnalysisDocumentContent} from './AnalysisDocumentSliceConfig';
import {createEmptyAnalysisDocumentContent} from './AnalysisDocumentSliceConfig';
import {useStoreWithAnalysisDocuments} from './useStoreWithAnalysisDocuments';

export const AnalysisDocumentArtifact: React.FC<{artifactId: string}> = ({
  artifactId,
}) => {
  const {analysis, ensureAnalysis, setContent} = useStoreWithAnalysisDocuments(
    useShallow((state) => ({
      analysis: state.analysisDocuments.config.artifacts[artifactId],
      ensureAnalysis: state.analysisDocuments.ensureAnalysis,
      setContent: state.analysisDocuments.setContent,
    })),
  );

  useEffect(() => {
    if (!analysis) {
      ensureAnalysis(artifactId);
    }
  }, [artifactId, analysis, ensureAnalysis]);

  const handleChange = useCallback(
    (content: AnalysisDocumentContent) => {
      setContent(artifactId, content);
    },
    [artifactId, setContent],
  );

  return (
    <AnalysisDocumentEditor
      analysisId={artifactId}
      value={analysis?.content ?? createEmptyAnalysisDocumentContent()}
      assets={analysis?.assets}
      onChange={handleChange}
    >
      <AnalysisDocumentEditor.Toolbar />
      <AnalysisDocumentEditor.Content />
    </AnalysisDocumentEditor>
  );
};
