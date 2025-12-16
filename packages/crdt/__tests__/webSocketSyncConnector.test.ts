import {describe, expect, it} from '@jest/globals';
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
  it('buffers local updates before join and flushes after crdt-joined', async () => {
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

    // Server confirms join; buffered update should flush as a binary payload.
    ws.message(JSON.stringify({type: 'crdt-joined', roomId: 'room-1'}));
    expect(ws.sent.some((m) => typeof m !== 'string')).toBe(true);

    const sendsAfterJoin = ws.sent.length;

    // Subsequent local updates should send immediately as binary payloads.
    doc.getMap('map').set('k2', 'v2');
    doc.commit();
    expect(ws.sent.length).toBeGreaterThan(sendsAfterJoin);
    expect(ws.sent[ws.sent.length - 1]).not.toEqual(
      expect.stringContaining('crdt-join'),
    );
  });
});
