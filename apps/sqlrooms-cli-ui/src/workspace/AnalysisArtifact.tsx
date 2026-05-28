import {
  AnalysisChartRendererProvider,
  AnalysisDocumentArtifact,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../store';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';

export const AnalysisArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureAnalysis = useRoomStore(
    (state) => state.analysisDocuments.ensureAnalysis,
  );

  useEffect(() => {
    if (artifact?.type === 'analysis') {
      ensureAnalysis(artifactId);
    }
  }, [artifact?.type, artifactId, ensureAnalysis]);

  if (!artifact || artifact.type !== 'analysis') {
    return null;
  }

  return (
    <AnalysisChartRendererProvider renderer={AnalysisChartRenderer}>
      <AnalysisDocumentArtifact artifactId={artifactId} />
    </AnalysisChartRendererProvider>
  );
};
