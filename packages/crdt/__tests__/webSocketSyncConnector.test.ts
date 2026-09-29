import {describe, expect, it, jest} from '@jest/globals';
import {LoroDoc} from 'loro-crdt';

import {createWebSocketSyncConnector} from '../src';

type Listener = (event: any) => void;

class FakeWebSocket {
  readyState = 0;
  sent: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {code: 1000, reason: ''});
  }

  open() {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(data: any) {
    this.emit('message', {data});
  }

  private emit(type: string, event: any) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of Array.from(set)) listener(event);
  }
}

describe('createWebSocketSyncConnector', () => {
  it('buffers local updates before join and flushes after server snapshot arrives', async () => {
    const ws = new FakeWebSocket();

    const connector = createWebSocketSyncConnector({
      url: 'ws://example.test',
      roomId: 'room-1',
      sendSnapshotOnConnect: false,
      createSocket: () => ws,
    });

    const doc = new LoroDoc();
    await connector.connect(doc);

    // Produce a local update before the socket is open; it should buffer (no sends yet).
    doc.getMap('map').set('k1', 'v1');
    doc.commit();
    expect(ws.sent.length).toBe(0);

    // Open socket: connector should send join.
    ws.open();
    expect(
      ws.sent.some((m) => typeof m === 'string' && m.includes('crdt-join')),
    ).toBe(true);

    // Server confirms join and then sends a snapshot; buffered update should flush after
    // snapshot is applied (connector intentionally waits for the snapshot to avoid
    // broadcasting "empty state" ops from a refreshing client).
    ws.message(JSON.stringify({type: 'crdt-joined', roomId: 'room-1'}));

    const serverDoc = new LoroDoc();
    serverDoc.getMap('map').set('server', 's1');
    serverDoc.commit();
    const serverSnapshotB64 = Buffer.from(
      serverDoc.export({mode: 'snapshot'}),
    ).toString('base64');
    ws.message(
      JSON.stringify({
        type: 'crdt-snapshot',
        roomId: 'room-1',
        data: serverSnapshotB64,
      }),
    );

    expect(ws.sent.some((m) => typeof m !== 'string')).toBe(true);

    const sendsAfterJoin = ws.sent.length;

    // Subsequent local updates should send immediately as binary payloads.
    doc.getMap('map').set('k2', 'v2');
    doc.commit();
    expect(ws.sent.length).toBeGreaterThan(sendsAfterJoin);
    expect(ws.sent[ws.sent.length - 1]).not.toEqual(
      expect.stringContaining('crdt-join'),
    );
    await connector.disconnect();
  });

  it.each([false, true])(
    'authenticates before joining or sending document data (already open: %s)',
    async (alreadyOpen) => {
      const ws = new FakeWebSocket();
      if (alreadyOpen) ws.readyState = 1;
      const urls: string[] = [];
      const connector = createWebSocketSyncConnector({
        url: 'ws://example.test/ws/duckdb',
        roomId: 'room-1',
        token: 'page-secret',
        createSocket: (url) => {
          urls.push(url);
          return ws;
        },
      });
      const doc = new LoroDoc();
      await connector.connect(doc);
      if (!alreadyOpen) ws.open();
      doc.getMap('map').set('local', 'value');
      doc.commit();
      expect(new URL(urls[0]!).searchParams.has('token')).toBe(false);
      expect(urls[0]).not.toContain('page-secret');
      expect(ws.sent).toEqual([
        JSON.stringify({type: 'auth', token: 'page-secret'}),
      ]);
      ws.message(JSON.stringify({type: 'authAck'}));
      expect(
        ws.sent.slice(1).map((value) => JSON.parse(value as string).type),
      ).toEqual(['crdt-join', 'crdt-snapshot']);
      ws.message(JSON.stringify({type: 'crdt-joined'}));
      const remote = new LoroDoc();
      remote.getMap('map').set('remote', 'value');
      remote.commit();
      ws.message(
        JSON.stringify({
          type: 'crdt-snapshot',
          data: Buffer.from(remote.export({mode: 'snapshot'})).toString(
            'base64',
          ),
        }),
      );
      expect(doc.getMap('map').get('remote')).toBe('value');
      expect(ws.sent.some((value) => typeof value !== 'string')).toBe(true);
      await connector.disconnect();
    },
  );

  it.each(['rejection', 'binary', 'timeout'])(
    'fails closed on authentication %s and authenticates again on reconnect',
    async (failure) => {
      jest.useFakeTimers();
      const sockets: FakeWebSocket[] = [];
      const connector = createWebSocketSyncConnector({
        url: 'ws://example.test/ws/duckdb',
        roomId: 'room-1',
        token: 'page-secret',
        initialDelayMs: 1,
        maxRetries: 1,
        createSocket: () => {
          const ws = new FakeWebSocket();
          sockets.push(ws);
          return ws;
        },
      });
      try {
        const doc = new LoroDoc();
        await connector.connect(doc);
        const ws = sockets[0]!;
        ws.open();
        if (failure === 'timeout') await jest.advanceTimersByTimeAsync(5000);
        else
          ws.message(
            failure === 'binary'
              ? new Uint8Array([1, 2])
              : JSON.stringify({type: 'error', error: 'unauthorized'}),
          );
        expect(ws.readyState).toBe(3);
        expect(ws.sent).toHaveLength(1);
        await jest.advanceTimersByTimeAsync(1);
        const retry = sockets[1]!;
        retry.open();
        expect(retry.sent).toEqual([
          JSON.stringify({type: 'auth', token: 'page-secret'}),
        ]);
        if (failure === 'timeout') {
          retry.message(JSON.stringify({type: 'authAck'}));
          expect(retry.sent).toHaveLength(3);
        } else {
          retry.message(JSON.stringify({type: 'error', error: 'unauthorized'}));
          await jest.advanceTimersByTimeAsync(10_000);
          expect(sockets).toHaveLength(2);
        }
      } finally {
        await connector.disconnect();
        jest.useRealTimers();
      }
    },
  );
});
