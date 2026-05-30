import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentStatefulBlockRenderer,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {DataTableBlockRenderer} from '@sqlrooms/mosaic';
import {useCallback, useEffect, useMemo} from 'react';
import {useRoomStore} from '../store';
import {
  createStatefulBlockTypes,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import {WorksheetChartRenderer} from './WorksheetChartRenderer';
import {WorksheetDashboardBlockRenderer} from './WorksheetDashboardBlockRenderer';
import {WorksheetMarkdownDocumentBlockRenderer} from './WorksheetMarkdownDocumentBlockRenderer';
import {WorksheetPivotBlockRenderer} from './WorksheetPivotBlockRenderer';

const WORKSHEET_STATEFUL_BLOCK_RENDERERS = {
  dashboard: WorksheetDashboardBlockRenderer,
  pivot: WorksheetPivotBlockRenderer,
  'data-table': DataTableBlockRenderer,
  document: WorksheetMarkdownDocumentBlockRenderer,
} satisfies Record<
  StatefulBlockArtifactType,
  BlockDocumentStatefulBlockRenderer
>;

export const WorksheetArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureBlockDocument = useRoomStore(
    (state) => state.blockDocuments.ensureBlockDocument,
  );
  const renameArtifact = useRoomStore((state) => state.artifacts.renameArtifact);

  useEffect(() => {
    if (artifact?.type === 'worksheet') {
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

  if (!artifact || artifact.type !== 'worksheet') {
    return null;
  }

  return (
    <BlockDocumentChartRendererProvider renderer={WorksheetChartRenderer}>
      <BlockDocumentStatefulBlockRendererProvider
        renderers={WORKSHEET_STATEFUL_BLOCK_RENDERERS}
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
