import {
  BlocksDocumentChartRendererProvider,
  BlocksDocumentArtifact,
  BlocksDocumentEmbedRendererProvider,
  type BlocksDocumentArtifactEmbedType,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';
import {AnalysisDashboardEmbedRenderer} from './AnalysisDashboardEmbedRenderer';
import {AnalysisPivotEmbedRenderer} from './AnalysisPivotEmbedRenderer';

export const AnalysisArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureBlocksDocument = useRoomStore(
    (state) => state.blocksDocuments.ensureBlocksDocument,
  );

  useEffect(() => {
    if (artifact?.type === 'analysis') {
      ensureBlocksDocument(artifactId);
    }
  }, [artifact?.type, artifactId, ensureBlocksDocument]);

  const artifactTypes = useMemo<BlocksDocumentArtifactEmbedType[]>(
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
            type: 'blocksDocumentArtifactEmbed',
            attrs: {
              id: blockId,
              artifactId: dashboardArtifactId,
              artifactType: 'dashboard',
              caption: '',
            },
          };
        },
      },
      {
        artifactType: 'pivot',
        label: 'Pivot Table',
        description: 'Embedded pivot table',
        createNode: (blockId) => {
          const state = useRoomStore.getState();
          const pivotArtifactId = state.artifacts.createArtifact({
            type: 'pivot',
            title: 'Embedded Pivot Table',
            visibility: 'embedded',
            parentArtifactId: artifactId,
          });
          state.pivot.ensurePivot(pivotArtifactId, {
            title: 'Embedded Pivot Table',
          });
          return {
            type: 'blocksDocumentArtifactEmbed',
            attrs: {
              id: blockId,
              artifactId: pivotArtifactId,
              artifactType: 'pivot',
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
    <BlocksDocumentChartRendererProvider renderer={AnalysisChartRenderer}>
      <BlocksDocumentEmbedRendererProvider
        renderers={{
          dashboard: AnalysisDashboardEmbedRenderer,
          pivot: AnalysisPivotEmbedRenderer,
        }}
        artifactTypes={artifactTypes}
      >
        <BlocksDocumentArtifact artifactId={artifactId} />
      </BlocksDocumentEmbedRendererProvider>
    </BlocksDocumentChartRendererProvider>
  );
};
