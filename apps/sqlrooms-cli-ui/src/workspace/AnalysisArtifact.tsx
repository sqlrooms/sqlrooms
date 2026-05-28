import {
  AnalysisChartRendererProvider,
  AnalysisDocumentArtifact,
  AnalysisEmbedRendererProvider,
  type AnalysisArtifactEmbedType,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';
import {AnalysisDashboardEmbedRenderer} from './AnalysisDashboardEmbedRenderer';

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

  const artifactTypes = useMemo<AnalysisArtifactEmbedType[]>(
    () => [
      {
        artifactType: 'dashboard',
        label: 'Dashboard',
        description: 'Embedded dashboard',
        createNode: (blockId) => {
          const state = useRoomStore.getState();
          const dashboardArtifactId = state.artifacts.createArtifact({
            type: 'dashboard',
            title: 'Embedded Dashboard',
            visibility: 'embedded',
            parentArtifactId: artifactId,
          });
          state.dashboard.ensureDashboardArtifact(dashboardArtifactId);
          return {
            type: 'analysisArtifactEmbed',
            attrs: {
              id: blockId,
              artifactId: dashboardArtifactId,
              artifactType: 'dashboard',
              caption: '',
            },
          };
        },
      },
    ],
    [artifactId],
  );

  if (!artifact || artifact.type !== 'analysis') {
    return null;
  }

  return (
    <AnalysisChartRendererProvider renderer={AnalysisChartRenderer}>
      <AnalysisEmbedRendererProvider
        renderers={{dashboard: AnalysisDashboardEmbedRenderer}}
        artifactTypes={artifactTypes}
      >
        <AnalysisDocumentArtifact artifactId={artifactId} />
      </AnalysisEmbedRendererProvider>
    </AnalysisChartRendererProvider>
  );
};
