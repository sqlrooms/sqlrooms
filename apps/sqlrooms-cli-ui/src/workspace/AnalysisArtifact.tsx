import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentStatefulBlockRenderer,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useCallback, useEffect, useMemo} from 'react';
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
  const renameArtifact = useRoomStore((state) => state.artifacts.renameArtifact);

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

  const handleTitleChange = useCallback(
    (title: string) => {
      renameArtifact(artifactId, title);
    },
    [artifactId, renameArtifact],
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
        <BlockDocumentArtifact
          artifactId={artifactId}
          title={artifact.title}
          onTitleChange={handleTitleChange}
        />
      </BlockDocumentStatefulBlockRendererProvider>
    </BlockDocumentChartRendererProvider>
  );
};
