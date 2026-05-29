import {
  BlocksDocumentChartRendererProvider,
  BlocksDocumentArtifact,
  BlocksDocumentEmbedRendererProvider,
  BlocksDocumentStatefulBlockRendererProvider,
  type BlocksDocumentArtifactEmbedRenderer,
  type BlocksDocumentStatefulBlockRenderer,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';
import {
  createStatefulBlockTypes,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import {AnalysisChartRenderer} from './AnalysisChartRenderer';
import {AnalysisDashboardBlockRenderer} from './AnalysisDashboardBlockRenderer';
import {AnalysisDashboardEmbedRenderer} from './AnalysisDashboardEmbedRenderer';
import {AnalysisMarkdownDocumentBlockRenderer} from './AnalysisMarkdownDocumentBlockRenderer';
import {AnalysisPivotBlockRenderer} from './AnalysisPivotBlockRenderer';
import {AnalysisPivotEmbedRenderer} from './AnalysisPivotEmbedRenderer';

type ArtifactEmbedCompatibilityType = 'dashboard' | 'pivot';

const ANALYSIS_EMBED_RENDERERS = {
  dashboard: AnalysisDashboardEmbedRenderer,
  pivot: AnalysisPivotEmbedRenderer,
} satisfies Record<
  ArtifactEmbedCompatibilityType,
  BlocksDocumentArtifactEmbedRenderer
>;

const ANALYSIS_STATEFUL_BLOCK_RENDERERS = {
  dashboard: AnalysisDashboardBlockRenderer,
  pivot: AnalysisPivotBlockRenderer,
  document: AnalysisMarkdownDocumentBlockRenderer,
} satisfies Record<
  StatefulBlockArtifactType,
  BlocksDocumentStatefulBlockRenderer
>;

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

  const statefulBlockTypes = useMemo(
    () =>
      createStatefulBlockTypes({
        getState: useRoomStore.getState,
      }),
    [],
  );

  if (!artifact || artifact.type !== 'analysis') {
    return null;
  }

  return (
    <BlocksDocumentChartRendererProvider renderer={AnalysisChartRenderer}>
      <BlocksDocumentStatefulBlockRendererProvider
        renderers={ANALYSIS_STATEFUL_BLOCK_RENDERERS}
        blockTypes={statefulBlockTypes}
      >
        <BlocksDocumentEmbedRendererProvider
          renderers={ANALYSIS_EMBED_RENDERERS}
          artifactTypes={[]}
        >
          <BlocksDocumentArtifact artifactId={artifactId} />
        </BlocksDocumentEmbedRendererProvider>
      </BlocksDocumentStatefulBlockRendererProvider>
    </BlocksDocumentChartRendererProvider>
  );
};
