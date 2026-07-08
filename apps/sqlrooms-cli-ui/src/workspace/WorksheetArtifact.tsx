import {BlockAiPromptPopover} from '@sqlrooms/ai';
import {HtmlAppBlock} from '@sqlrooms/app-runtime';
import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockSettingsPanelLayout,
  BlockDocumentStatefulBlockRendererProvider,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentBlockHeaderActionsRenderContext,
  type Editor,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  ChartBlockRenderer,
  ChartBlockSettings,
  DataTableBlockRenderer,
} from '@sqlrooms/mosaic';
import {Button} from '@sqlrooms/ui';
import {SparklesIcon} from 'lucide-react';
import {PythonBlock} from '@sqlrooms/python/block';
import {FC, useCallback, useEffect, useMemo, useState} from 'react';
import {startBlockScopedChat} from '../ai/startBlockScopedChat';
import {CLI_AI_BLOCK_TYPES} from '../artifactTypeIds';
import {experimentalEnabled, useRoomStore} from '../store';
import {
  createStatefulBlockTypes,
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
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

  const handleTableNameChange = useCallback(
    (tableName: string | undefined) => {
      if (props.onTableNameChange) {
        props.onTableNameChange(tableName);
        return;
      }

      updateBlock(props.documentId, props.blockId, {
        id: props.blockId,
        type: 'statefulBlock',
        blockType: props.blockType,
        blockInstanceId: props.blockInstanceId,
        ownership: normalizeStatefulBlockOwnership(props.ownership),
        caption: props.caption,
        tableName: tableName || undefined,
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
      props.onTableNameChange,
      props.ownership,
      updateBlock,
    ],
  );

  return (
    <DataTableBlockRenderer
      {...props}
      onTableNameChange={handleTableNameChange}
    />
  );
};

const WorksheetHtmlAppBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => {
  const appTitle = useRoomStore((state) =>
    props.blockInstanceId
      ? state.htmlApps.config.appsById[props.blockInstanceId]?.title
      : undefined,
  );
  return (
    <HtmlAppBlock
      blockId={props.blockInstanceId}
      title={appTitle}
      className="bg-background h-full min-h-80"
      headerActions={props.headerActions}
    />
  );
};

const WorksheetPythonBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => {
  const pythonTitle = useRoomStore((state) =>
    props.blockInstanceId
      ? state.python.config.blocks[props.blockInstanceId]?.title
      : undefined,
  );
  return (
    <PythonBlock
      artifactId={props.documentId}
      blockId={props.blockInstanceId}
      blockType={props.blockType}
      title={pythonTitle}
      readOnly={props.readOnly}
      compact
    />
  );
};

const ExperimentalStatefulBlockPlaceholder: FC<
  BlockDocumentStatefulBlockRendererProps
> = (props) => {
  const label = isStatefulBlockArtifactType(props.blockType)
    ? getStatefulBlockArtifactConfig(props.blockType).label
    : undefined;
  return (
    <div className="bg-muted/20 flex h-full min-h-40 items-center justify-center p-4 text-center">
      <div className="bg-background max-w-md rounded-md border p-4">
        <div className="text-sm font-medium">
          {props.caption || label || 'Experimental block'}
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
};

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

const WORKSHEET_AI_BLOCK_TYPES = new Set<string>(CLI_AI_BLOCK_TYPES);

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
  const setLayoutCollapsed = useRoomStore((state) => state.layout.setCollapsed);
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

  const revealAssistant = useCallback(() => {
    setLayoutCollapsed('assistant-sidebar', false);
  }, [setLayoutCollapsed]);

  const renderBlockHeaderActions = useCallback(
    ({
      blockDocumentId,
      blockId,
      blockType,
      blockInstanceId,
    }: BlockDocumentBlockHeaderActionsRenderContext) => {
      if (!WORKSHEET_AI_BLOCK_TYPES.has(blockType)) {
        return null;
      }

      return (
        <BlockAiPromptPopover
          label="Ask AI"
          placeholder="Ask AI to edit this block..."
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Ask AI"
              title="Ask AI"
            >
              <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
            </Button>
          }
          onSubmit={(prompt) =>
            void startBlockScopedChat({
              target: {
                blockDocumentId,
                blockId,
                blockType,
                blockInstanceId,
              },
              prompt,
              revealAssistant,
            })
          }
        />
      );
    },
    [revealAssistant],
  );

  if (!artifact || artifact.type !== 'worksheet') {
    return null;
  }

  return (
    <BlockDocumentChartRendererProvider
      renderer={ChartBlockRenderer}
      settings={ChartBlockSettings}
      renderBlockHeaderActions={renderBlockHeaderActions}
    >
      <BlockDocumentStatefulBlockRendererProvider
        renderers={statefulBlockRenderers}
        blockTypes={statefulBlockTypes}
        renderBlockHeaderActions={renderBlockHeaderActions}
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
