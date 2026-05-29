import {
  BlocksDocumentChartRendererProvider,
  BlocksDocumentArtifact,
  BlocksDocumentEmbedRendererProvider,
  type BlocksDocumentArtifactEmbedRenderer,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';
import {
  createStatefulBlockArtifactEmbedTypes,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';
import {AnalysisDashboardEmbedRenderer} from './AnalysisDashboardEmbedRenderer';
import {AnalysisPivotEmbedRenderer} from './AnalysisPivotEmbedRenderer';

const ANALYSIS_EMBED_RENDERERS = {
  dashboard: AnalysisDashboardEmbedRenderer,
  pivot: AnalysisPivotEmbedRenderer,
} satisfies Record<StatefulBlockArtifactType, BlocksDocumentArtifactEmbedRenderer>;

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

  const artifactTypes = useMemo(
    () =>
      createStatefulBlockArtifactEmbedTypes({
        parentArtifactId: artifactId,
        getState: useRoomStore.getState,
      }),
    [artifactId],
  );

  if (!artifact || artifact.type !== 'analysis') {
    return null;
  }

  return (
    <BlocksDocumentChartRendererProvider renderer={AnalysisChartRenderer}>
      <BlocksDocumentEmbedRendererProvider
        renderers={ANALYSIS_EMBED_RENDERERS}
        artifactTypes={artifactTypes}
      >
        <BlocksDocumentArtifact artifactId={artifactId} />
      </BlocksDocumentEmbedRendererProvider>
    </BlocksDocumentChartRendererProvider>
  );
};
