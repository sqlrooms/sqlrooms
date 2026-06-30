import {HtmlAppBlock} from '@sqlrooms/app-runtime';
import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockSettingsPanelLayout,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type Editor,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  ChartBlockRenderer,
  ChartBlockSettings,
  DataTableBlockRenderer,
} from '@sqlrooms/mosaic';
import {PythonBlock} from '@sqlrooms/python/block';
import {FC, useCallback, useEffect, useMemo, useState} from 'react';
import {experimentalEnabled, useRoomStore} from '../store';
import {
  createStatefulBlockTypes,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import {WorksheetDashboardBlockRenderer} from './WorksheetDashboardBlockRenderer';
import {WorksheetMapBlockRenderer} from './WorksheetMapBlockRenderer';
import {WorksheetMarkdownDocumentBlockRenderer} from './WorksheetMarkdownDocumentBlockRenderer';
import {WorksheetPivotBlockRenderer} from './WorksheetPivotBlockRenderer';
import {WorksheetSqlQueryBlockRenderer} from './WorksheetSqlQueryBlockRenderer';

function normalizeStatefulBlockOwnership(ownership: string | undefined) {
  return ownership === 'owned' ||
    ownership === 'shared' ||
    ownership === 'external'
    ? ownership
    : undefined;
}

const WorksheetDataTableBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => {
  const updateBlock = useRoomStore((state) => state.blockDocuments.updateBlock);

  const handleTitleChange = useCallback(
    (title: string | undefined) => {
      if (props.onTitleChange) {
        props.onTitleChange(title);
        return;
      }

      updateBlock(props.documentId, props.blockId, {
        id: props.blockId,
        type: 'statefulBlock',
        blockType: props.blockType,
        blockInstanceId: props.blockInstanceId,
        ownership: normalizeStatefulBlockOwnership(props.ownership),
        title: title || undefined,
        caption: props.caption,
        height: props.height,
      });
    },
    [
      props.blockId,
      props.blockInstanceId,
      props.blockType,
      props.caption,
      props.documentId,
      props.height,
      props.onTitleChange,
      props.ownership,
      updateBlock,
    ],
  );

  return (
    <DataTableBlockRenderer {...props} onTitleChange={handleTitleChange} />
  );
};

const WorksheetHtmlAppBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => (
  <HtmlAppBlock
    blockId={props.blockInstanceId}
    title={props.title}
    className="bg-background h-full min-h-80"
  />
);

const WorksheetPythonBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => (
  <PythonBlock
    artifactId={props.documentId}
    blockId={props.blockInstanceId}
    blockType={props.blockType}
    title={props.title}
    readOnly={props.readOnly}
    compact
  />
);

const ExperimentalStatefulBlockPlaceholder: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => (
  <div className="bg-muted/20 flex h-full min-h-40 items-center justify-center p-4 text-center">
    <div className="bg-background max-w-md rounded-md border p-4">
      <div className="text-sm font-medium">
        {props.title || 'Experimental block'}
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        This block uses an experimental SQLRooms surface. Reopen this project
        with --experimental to view and edit it.
      </p>
      <div className="text-muted-foreground mt-3 text-xs">
        Block type: {props.blockType}
      </div>
    </div>
  </div>
);

const WORKSHEET_STATEFUL_BLOCK_RENDERERS = {
  dashboard: WorksheetDashboardBlockRenderer,
  map: WorksheetMapBlockRenderer,
  pivot: WorksheetPivotBlockRenderer,
  'data-table': WorksheetDataTableBlockRenderer,
  document: WorksheetMarkdownDocumentBlockRenderer,
  'sql-query': WorksheetSqlQueryBlockRenderer,
  'html-app': WorksheetHtmlAppBlockRenderer,
  python: WorksheetPythonBlockRenderer,
} satisfies Record<
  StatefulBlockArtifactType,
  BlockDocumentStatefulBlockRenderer
>;

function createWorksheetStatefulBlockRenderers(
  includeExperimental: boolean,
): Record<StatefulBlockArtifactType, BlockDocumentStatefulBlockRenderer> {
  if (includeExperimental) {
    return WORKSHEET_STATEFUL_BLOCK_RENDERERS;
  }
  return {
    ...WORKSHEET_STATEFUL_BLOCK_RENDERERS,
    map: ExperimentalStatefulBlockPlaceholder,
    pivot: ExperimentalStatefulBlockPlaceholder,
    document: ExperimentalStatefulBlockPlaceholder,
    'sql-query': ExperimentalStatefulBlockPlaceholder,
    'html-app': ExperimentalStatefulBlockPlaceholder,
    python: ExperimentalStatefulBlockPlaceholder,
  };
}

export const WorksheetArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const artifactId = (meta?.artifactId as string) ?? panelId;
  const artifact = useRoomStore((state) =>
    state.artifacts.getArtifact(artifactId),
  );
  const ensureBlockDocument = useRoomStore(
    (state) => state.blockDocuments.ensureBlockDocument,
  );
  const renameArtifact = useRoomStore(
    (state) => state.artifacts.renameArtifact,
  );
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (artifact?.type === 'worksheet') {
      ensureBlockDocument(artifactId);
    }
  }, [artifact?.type, artifactId, ensureBlockDocument]);

  const statefulBlockTypes = useMemo(
    () =>
      createStatefulBlockTypes({
        getState: useRoomStore.getState,
        experimentalEnabled,
      }),
    [],
  );
  const statefulBlockRenderers = useMemo(
    () => createWorksheetStatefulBlockRenderers(experimentalEnabled),
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
    <BlockDocumentChartRendererProvider
      renderer={ChartBlockRenderer}
      settings={ChartBlockSettings}
    >
      <BlockDocumentStatefulBlockRendererProvider
        renderers={statefulBlockRenderers}
        blockTypes={statefulBlockTypes}
      >
        <BlockSettingsPanelLayout editor={editor} documentId={artifactId}>
          <BlockDocumentArtifact
            artifactId={artifactId}
            title={artifact.title}
            onTitleChange={handleTitleChange}
            onEditorReady={setEditor}
          />
        </BlockSettingsPanelLayout>
      </BlockDocumentStatefulBlockRendererProvider>
    </BlockDocumentChartRendererProvider>
  );
};
