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
import {TooltipProvider} from '@sqlrooms/ui';
import {HarnessRunChat} from '@sqlrooms/ai-core';
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
}[];
function WorkspaceView() {
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
    <div className="roomie roomie-node">
      <header className="roomie-header">
        <strong className="roomie-brand">Roomie</strong>
        <span>Document read-only</span>
        <span>{connection}</span>
        {approvalError && <span role="alert">{approvalError}</span>}
        {approvalConversations
          .filter((value) => value !== conversationId)
          .map((value) => (
            <button
              className="roomie-action"
              key={value}
              onClick={() => selectConversation(value)}
            >
              Approval waiting in {value.slice(0, 8)}
            </button>
          ))}
      </header>
      <div className="roomie-body">
        <nav className="roomie-sidebar">
          <h2>Documents</h2>
          {ids.map((value) => (
            <button
              className="block w-full p-2 text-left"
              key={value}
              onClick={() => setSelection(value)}
            >
              {artifacts[value]?.title}
            </button>
          ))}
          <h2>Conversations</h2>
          {conversationList.map((value) => (
            <button
              className="block w-full truncate p-2 text-left"
              key={value.id}
              onClick={() => setConversationId(value.id)}
            >
              {value.id.slice(0, 8)}
            </button>
          ))}
          <button onClick={() => setConversationId(undefined)}>
            New conversation
          </button>
        </nav>
        <main className="roomie-node-document min-w-0 flex-1 overflow-auto">
          {id ? (
            <BlockDocumentChartRendererProvider renderer={ChartBlockRenderer}>
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
        <aside className="roomie-node-chat flex shrink-0 flex-col border-l bg-white">
          <HarnessRunChat.Root
            key={conversationId ?? 'new'}
            client={harnessClient}
            conversationId={conversationId}
            onConversation={selectConversation}
          >
            <p className="p-3 text-xs">
              Host-owned conversation. Closing this tab leaves work running.
            </p>
            <HarnessRunChat.Approvals />
            <HarnessRunChat.Messages className="min-h-0 flex-1" />
            <HarnessRunChat.Details onArtifact={setSelection} />
            <HarnessRunChat.Controls />
          </HarnessRunChat.Root>
        </aside>
      </div>
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
