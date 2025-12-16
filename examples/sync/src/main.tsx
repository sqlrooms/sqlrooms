import {useEffect, useState} from 'react';
import ReactDOM from 'react-dom/client';
import {schema} from 'loro-mirror';
import {create} from 'zustand';

import {
  createCrdtSlice,
  createLocalStorageDocStorage,
  createWebSocketSyncConnector,
  CrdtSliceState,
} from '@sqlrooms/crdt';

type AppState = CrdtSliceState & {
  counter: number;
  title: string;
  setCounter: (value: number) => void;
  setTitle: (title: string) => void;
};

const sharedValueSchema = schema.LoroMap({
  counter: schema.Number(),
  title: schema.String(),
});

const useStore = create<AppState>()((set, get, storeApi) => {
  const connector = createWebSocketSyncConnector({
    url: (import.meta as any).env?.VITE_SYNC_WS_URL ?? 'ws://localhost:4000',
    roomId: (import.meta as any).env?.VITE_SYNC_ROOM_ID ?? 'demo-room',
    // `sqlrooms-duckdb-server` sends a snapshot to clients on join already.
    sendSnapshotOnConnect: false,
  });

  const crdtSlice = createCrdtSlice<AppState>({
    mirrors: {
      shared: {
        schema: sharedValueSchema,
        select: (s) => ({counter: s.counter, title: s.title}),
        apply: (value: any) =>
          set((state) => ({
            ...state,
            counter: value.counter,
            title: value.title,
          })),
      },
    },
    storage: createLocalStorageDocStorage('sqlrooms-sync-example'),
    sync: connector,
  })(set as any, get as any, storeApi as any);

  return {
    counter: 0,
    title: 'Hello CRDT',
    setCounter: (value: number) => set({counter: value}),
    setTitle: (title: string) => set({title}),
    ...(crdtSlice as CrdtSliceState),
  };
});

function App() {
  const counter = useStore((s) => s.counter);
  const title = useStore((s) => s.title);
  const setCounter = useStore((s) => s.setCounter);
  const setTitle = useStore((s) => s.setTitle);
  const crdt = useStore((s) => s.crdt);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    crdt.initialize().catch((err) => {
      if (!cancelled) setInitError(String(err));
    });
    return () => {
      cancelled = true;
      void crdt.destroy();
    };
  }, []);

  return (
    <div
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        maxWidth: 560,
        margin: '2rem auto',
      }}
    >
      <h1>SQLRooms CRDT Sync</h1>
      <p style={{color: '#555'}}>
        Connects to sqlrooms-duckdb-server with CRDT enabled.
      </p>

      <div
        style={{
          margin: '1rem 0',
          padding: '0.75rem',
          border: '1px solid #ddd',
          borderRadius: 8,
        }}
      >
        <div>
          <strong>Connection:</strong> {crdt.connectionStatus}
        </div>
        <div>
          <strong>CRDT status:</strong> {crdt.status}
        </div>
        {initError && (
          <div style={{color: 'crimson'}}>Init error: {initError}</div>
        )}
      </div>

      <label style={{display: 'block', marginBottom: 12}}>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{display: 'block', width: '100%', padding: 8, marginTop: 4}}
        />
      </label>

      <label style={{display: 'block', marginBottom: 12}}>
        Counter
        <input
          type="number"
          value={counter}
          onChange={(e) => setCounter(Number(e.target.value))}
          style={{display: 'block', width: '100%', padding: 8, marginTop: 4}}
        />
      </label>

      <div style={{display: 'flex', gap: 8}}>
        <button onClick={() => setCounter(counter - 1)}>-1</button>
        <button onClick={() => setCounter(counter + 1)}>+1</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
);
