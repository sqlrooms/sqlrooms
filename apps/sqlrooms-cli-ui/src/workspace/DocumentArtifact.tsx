import {
  createAskAiBlockHeaderAction,
  type AskAiBlockHeaderActionRenderContext,
} from '@sqlrooms/ai';
import {HtmlAppBlock} from '@sqlrooms/app-runtime';
import {
  BlockDocumentChartRendererProvider,
  BlockDocumentArtifact,
  BlockSettingsPanelLayout,
  BlockDocumentStatefulBlockRendererProvider,
  startBlockScopedChat,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type Editor,
  type StartBlockScopedChatActions,
} from '@sqlrooms/documents';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {
  ChartBlockRenderer,
  ChartBlockSettings,
  DataTableBlockRenderer,
} from '@sqlrooms/mosaic';
import {PythonBlock} from '@sqlrooms/python/block';
import {FC, useCallback, useEffect, useMemo, useState} from 'react';
import {useCliRoomStoreApi, useRoomStore} from '../roomStoreHooks';
import {cliCapabilityProfile} from '../runtimeEnvironment';
import type {RoomState} from '../store-types';
import type {CliCapabilityProfile} from '../profiles';
import {
  createStatefulBlockTypes,
  type StatefulBlockArtifactType,
} from '../statefulBlockArtifactConfigs';
import {DocumentDashboardBlockRenderer} from './DocumentDashboardBlockRenderer';
import {DocumentMapBlockRenderer} from './DocumentMapBlockRenderer';
import {MarkdownDocumentBlockRenderer} from './MarkdownDocumentBlockRenderer';
import {DocumentPivotBlockRenderer} from './DocumentPivotBlockRenderer';
import {DocumentSqlQueryBlockRenderer} from './DocumentSqlQueryBlockRenderer';
import {createProfiledDocumentStatefulBlockRenderers} from './documentStatefulBlockRenderers';

function normalizeStatefulBlockOwnership(ownership: string | undefined) {
  return ownership === 'owned' ||
    ownership === 'shared' ||
    ownership === 'external'
    ? ownership
    : undefined;
}

const DocumentDataTableBlockRenderer: FC<
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

const DocumentHtmlAppBlockRenderer: FC<
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

const DocumentPythonBlockRenderer: FC<
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

const DOCUMENT_STATEFUL_BLOCK_RENDERERS = {
  dashboard: DocumentDashboardBlockRenderer,
  map: DocumentMapBlockRenderer,
  pivot: DocumentPivotBlockRenderer,
  'data-table': DocumentDataTableBlockRenderer,
  'markdown-document': MarkdownDocumentBlockRenderer,
  'sql-query': DocumentSqlQueryBlockRenderer,
  'html-app': DocumentHtmlAppBlockRenderer,
  python: DocumentPythonBlockRenderer,
} satisfies Record<
  StatefulBlockArtifactType,
  BlockDocumentStatefulBlockRenderer
>;

function getEnabledDocumentAiBlockTypes(
  profile: CliCapabilityProfile,
): Set<string> {
  return new Set<string>(profile.blocks.aiContext);
}

function createStartBlockScopedChatActions(
  getState: () => RoomState,
): StartBlockScopedChatActions {
  return {
    getArtifact: (artifactId) => getState().artifacts.getArtifact(artifactId),
    getCurrentArtifactId: () => getState().artifacts.config.currentArtifactId,
    setCurrentArtifact: (artifactId) =>
      getState().artifacts.setCurrentArtifact(artifactId),
    getAiSessions: () => getState().ai.config.sessions,
    getSessionArtifactLinks: () =>
      getState().artifactAi.config.sessionArtifactLinks,
    createArtifactScopedSession: () =>
      getState().artifactAi.createArtifactScopedSession(),
    switchSession: (sessionId) => getState().ai.switchSession(sessionId),
    getSessionDraftContextItemIds: (sessionId) =>
      getState().ai.getSessionDraftContextItemIds(sessionId),
    setSessionDraftContextItemIds: (sessionId, ids) =>
      getState().ai.setSessionDraftContextItemIds(sessionId, ids),
    setPrompt: (sessionId, prompt) =>
      getState().ai.setPrompt(sessionId, prompt),
    startAnalysisWhenReady: (sessionId) =>
      getState().ai.startAnalysisWhenReady(sessionId),
  };
}

function createDocumentStatefulBlockRenderers(
  profile: CliCapabilityProfile,
): Record<StatefulBlockArtifactType, BlockDocumentStatefulBlockRenderer> {
  return createProfiledDocumentStatefulBlockRenderers(
    profile,
    DOCUMENT_STATEFUL_BLOCK_RENDERERS,
  );
}

export const DocumentArtifact: RoomPanelComponent = ({panelId, meta}) => {
  const roomStore = useCliRoomStoreApi();
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
    if (artifact?.type === 'block-document') {
      ensureBlockDocument(artifactId);
    }
  }, [artifact?.type, artifactId, ensureBlockDocument]);

  const statefulBlockTypes = useMemo(
    () =>
      createStatefulBlockTypes({
        getState: roomStore.getState,
        profile: cliCapabilityProfile,
      }),
    [roomStore],
  );
  const statefulBlockRenderers = useMemo(
    () => createDocumentStatefulBlockRenderers(cliCapabilityProfile),
    [],
  );

  const enabledDocumentAiBlockTypes = useMemo(
    () => getEnabledDocumentAiBlockTypes(cliCapabilityProfile),
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

  const renderBlockHeaderActions = useMemo(
    () =>
      createAskAiBlockHeaderAction({
        supportsAiEditing: (blockType) =>
          enabledDocumentAiBlockTypes.has(blockType),
        onSubmit: (
          ctx: AskAiBlockHeaderActionRenderContext,
          prompt: string,
        ) => {
          void startBlockScopedChat({
            target: {
              blockDocumentId: ctx.blockDocumentId,
              blockId: ctx.blockId,
              blockType: ctx.blockType,
              blockInstanceId: ctx.blockInstanceId,
            },
            prompt,
            revealAssistant,
            actions: createStartBlockScopedChatActions(roomStore.getState),
            isValidBlockDocumentArtifact: (candidate) =>
              candidate.type === 'block-document',
            artifactLabel: 'document',
          });
        },
      }),
    [revealAssistant, enabledDocumentAiBlockTypes],
  );

  if (!artifact || artifact.type !== 'block-document') {
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
