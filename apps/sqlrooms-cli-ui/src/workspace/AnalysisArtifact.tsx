import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentStatefulBlockRenderer,
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
import {AnalysisMarkdownDocumentBlockRenderer} from './AnalysisMarkdownDocumentBlockRenderer';
import {AnalysisPivotBlockRenderer} from './AnalysisPivotBlockRenderer';

const ANALYSIS_STATEFUL_BLOCK_RENDERERS = {
  dashboard: AnalysisDashboardBlockRenderer,
  pivot: AnalysisPivotBlockRenderer,
  document: AnalysisMarkdownDocumentBlockRenderer,
} satisfies Record<
  StatefulBlockArtifactType,
  BlockDocumentStatefulBlockRenderer
>;

export const AnalysisArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureBlockDocument = useRoomStore(
    (state) => state.blockDocuments.ensureBlockDocument,
  );

  useEffect(() => {
    if (artifact?.type === 'analysis') {
      ensureBlockDocument(artifactId);
    }
  }, [artifact?.type, artifactId, ensureBlockDocument]);

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
    <BlockDocumentChartRendererProvider renderer={AnalysisChartRenderer}>
      <BlockDocumentStatefulBlockRendererProvider
        renderers={ANALYSIS_STATEFUL_BLOCK_RENDERERS}
        blockTypes={statefulBlockTypes}
      >
        <BlockDocumentArtifact artifactId={artifactId} />
      </BlockDocumentStatefulBlockRendererProvider>
    </BlockDocumentChartRendererProvider>
  );
};
