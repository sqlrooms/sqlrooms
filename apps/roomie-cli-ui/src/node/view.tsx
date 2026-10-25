import {createRoot} from 'react-dom/client';
import {useEffect, useMemo, useState} from 'react';
import {createRoomStore, RoomStateProvider} from '@sqlrooms/room-store';
import {createRoomShellSlice} from '@sqlrooms/room-shell';
import {
  createWebSocketDuckDbConnector,
  makeQualifiedTableName,
  type DataTable,
} from '@sqlrooms/duckdb';
import {
  createMosaicSlice,
  ChartBlockRenderer,
  createDefaultChartTypes,
} from '@sqlrooms/mosaic';
import {
  BlockDocumentEditor,
  BlockDocumentChartRendererProvider,
} from '@sqlrooms/documents';
import {
  useIsMobile,
  TooltipProvider,
  Badge,
  Button,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@sqlrooms/ui';
import {HarnessRunChat, ChatHistoryItem} from '@sqlrooms/ai-core';
import {createRoomieDomainSlice} from '../createRoomieDomainSlice';
import type {RoomState} from '../RoomState';
import {RoomieContent} from '../stateOwnership';
import {mergeRoomieContent} from '../contentPersistence';
import {pageCredential} from './auth';
import {hostRequest, harnessClient, subscribeHost} from './client';
import '../style.css';

const connector = createWebSocketDuckDbConnector({
  wsUrl: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
  authToken: pageCredential(),
});
const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, api) => ({
    ...createRoomShellSlice({
      connector,
      config: {title: 'Roomie', dataSources: []},
    })(set, get, api),
    ...createMosaicSlice({preagg: {enabled: false}})(set, get, api),
    ...createRoomieDomainSlice({
      chartTypes: createDefaultChartTypes({includeCustomSpec: false}),
    })(set, get, api),
  }),
);
// Catalog inspection is a host API, separate from the restricted render-SQL surface.
roomStore.setState((state) => ({
  db: {
    ...state.db,
    async refreshTableSchemas() {
      const catalog = await hostRequest('/api/catalog');
      const tables = catalog.tables.map((value: DataTable) => ({
        ...value,
        table: makeQualifiedTableName(value.table),
      }));
      roomStore.setState((current) => ({
        db: {
          ...current.db,
          tables,
          currentDatabase: catalog.currentDatabase,
          currentSchema: catalog.currentSchema,
        },
      }));
      return tables;
    },
  },
}));
await roomStore.getState().room.initialize();
const initial = await hostRequest('/api/content');
roomStore.setState((current) =>
  mergeRoomieContent(current, RoomieContent.parse(initial.content)),
);
const conversations = (await hostRequest('/api/conversations')) as {
  id: string;
  title?: string;
  updatedAt?: string;
  status?: string;
}[];
function WorkspaceView() {
  const isMobile = useIsMobile();
  const artifacts = useRoomStore(
    (state) => state.artifacts.config.artifactsById,
  );
  const documents = useRoomStore(
    (state) => state.blockDocuments.config.artifacts,
  );
  const ids = useMemo(() => Object.keys(documents), [documents]);
  const [selection, setSelection] = useState<string>();
  const id =
    selection && documents[selection] ? selection : ids[ids.length - 1];
  const [conversationId, setConversationId] = useState<string | undefined>(
    conversations[0]?.id,
  );
  const [conversationList, setConversationList] = useState(conversations);
  const selectConversation = (value: string) => {
    setConversationId(value);
    setConversationList((current) =>
      current.some((item) => item.id === value)
        ? current
        : [{id: value}, ...current],
    );
  };
  const [approvalConversations, setApprovalConversations] = useState<string[]>(
    [],
  );
  const [approvalError, setApprovalError] = useState<string>();
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const refresh = () => {
      const requested = ++generation;
      void hostRequest('/api/approvals')
        .then((values) => {
          if (alive && requested === generation) {
            setApprovalError(undefined);
            setApprovalConversations([
              ...new Set<string>(
                values.map(
                  (value: {conversationId: string}) => value.conversationId,
                ),
              ),
            ]);
          }
        })
        .catch(() => {
          if (alive && requested === generation)
            setApprovalError(
              'Could not refresh pending approvals. Reconnect to retry.',
            );
        });
    };
    refresh();
    const stop = subscribeHost({
      afterSeq: 0,
      onStatus: (status) => {
        if (status === 'Connected') refresh();
      },
      onEvent: (event) => {
        if (event.kind.startsWith('approval.')) refresh();
      },
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void hostRequest('/api/conversations')
        .then((values) => {
          if (alive && generation === current) setConversationList(values);
        })
        .catch(() => {});
    };
    const stop = subscribeHost({
      afterSeq: 0,
      onStatus: (status) => {
        if (status === 'Connected') refresh();
      },
      onEvent: (event) => {
        if (event.kind === 'run.status' || event.kind === 'message.user')
          refresh();
      },
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  const [connection, setConnection] = useState('Connecting');
  useEffect(
    () =>
      subscribeHost({
        onStatus: setConnection,
        onContent: (content) => {
          roomStore.setState((current) =>
            mergeRoomieContent(current, RoomieContent.parse(content)),
          );
          void roomStore.getState().db.refreshTableSchemas();
        },
      }),
    [],
  );
  return (
    <div className="bg-background text-foreground flex h-svh min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b px-4 text-sm">
        <strong className="roomie-brand">Roomie</strong>
        <Badge variant="secondary">Documents read-only</Badge>
        <Badge variant="outline">{connection}</Badge>
        {approvalError && <span role="alert">{approvalError}</span>}
        {approvalConversations
          .filter((value) => value !== conversationId)
          .map((value) => (
            <Button
              variant="outline"
              size="sm"
              key={value}
              onClick={() => selectConversation(value)}
            >
              Approval waiting:{' '}
              {conversationList.find((item) => item.id === value)?.title ??
                'Conversation'}
            </Button>
          ))}
      </header>
      <SidebarProvider className="min-h-0! flex-1 overflow-hidden">
        <Sidebar
          collapsible="offcanvas"
          className="top-14! h-[calc(100svh-3.5rem)]!"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Documents</SidebarGroupLabel>
              <SidebarMenu>
                {ids.map((value) => (
                  <SidebarMenuItem key={value}>
                    <SidebarMenuButton
                      isActive={id === value}
                      onClick={() => setSelection(value)}
                    >
                      {artifacts[value]?.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Conversations</SidebarGroupLabel>
              <Button
                variant="outline"
                className="mb-3"
                onClick={() => setConversationId(undefined)}
              >
                New conversation
              </Button>
              <div className="space-y-2">
                {conversationList.map((value) => (
                  <ChatHistoryItem
                    key={value.id}
                    session={{
                      id: value.id,
                      name: value.title ?? 'New conversation',
                      lastOpenedAt: value.updatedAt
                        ? Date.parse(value.updatedAt)
                        : undefined,
                      isRunning: [
                        'running',
                        'queued',
                        'awaiting-approval',
                        'awaiting-input',
                      ].includes(value.status ?? ''),
                    }}
                    description={value.status ?? 'Starting'}
                    isActive={value.id === conversationId}
                    onClick={() => setConversationId(value.id)}
                  />
                ))}
              </div>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center border-b px-2">
            <SidebarTrigger />
            <span className="text-muted-foreground text-xs">Workspace</span>
          </div>
          <ResizablePanelGroup
            orientation={isMobile ? 'vertical' : 'horizontal'}
          >
            <ResizablePanel defaultSize="60%" minSize="25%">
              <main className="roomie-node-document h-full min-w-0 overflow-auto">
                {id ? (
                  <BlockDocumentChartRendererProvider
                    renderer={ChartBlockRenderer}
                  >
                    <BlockDocumentEditor
                      key={id}
                      documentId={id}
                      title={artifacts[id]?.title}
                      value={documents[id]!.content}
                      assets={documents[id]!.assets}
                      readOnly
                      onChange={() => {}}
                    >
                      <BlockDocumentEditor.Content />
                    </BlockDocumentEditor>
                  </BlockDocumentChartRendererProvider>
                ) : (
                  <p>Ask Roomie to create a document.</p>
                )}
                {id && (
                  <details>
                    <summary>Committed document source</summary>
                    <pre className="overflow-auto text-xs whitespace-pre-wrap">
                      {JSON.stringify(documents[id], null, 2)}
                    </pre>
                  </details>
                )}
              </main>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="40%" minSize="25%">
              <aside className="flex h-full min-h-0 flex-col overflow-y-auto">
                <HarnessRunChat.Root
                  key={conversationId ?? 'new'}
                  client={harnessClient}
                  conversationId={conversationId}
                  onConversation={selectConversation}
                  startBlockedReason={
                    conversationList.some(
                      (item) =>
                        item.id !== conversationId &&
                        [
                          'queued',
                          'running',
                          'awaiting-input',
                          'awaiting-approval',
                        ].includes(item.status ?? ''),
                    )
                      ? 'Another conversation is running. Open it to resolve approvals or stop it before starting here.'
                      : undefined
                  }
                >
                  <p className="p-3 text-xs">
                    Host-owned conversation. Closing this tab leaves work
                    running.
                  </p>
                  <HarnessRunChat.Approvals />
                  <HarnessRunChat.Messages
                    className={
                      isMobile ? 'min-h-40 flex-1 shrink-0' : 'min-h-0 flex-1'
                    }
                    onArtifact={setSelection}
                  />
                  <HarnessRunChat.Details />
                  <HarnessRunChat.Controls />
                </HarnessRunChat.Root>
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarProvider>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <RoomStateProvider roomStore={roomStore}>
    <TooltipProvider>
      <WorkspaceView />
    </TooltipProvider>
  </RoomStateProvider>,
);
