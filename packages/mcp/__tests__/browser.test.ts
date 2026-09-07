import {describe, expect, jest, test} from '@jest/globals';
import {registerBrowserMcpBridge} from '../src/browser';
import {MCP_BRIDGE_PROTOCOL_VERSION} from '../src/protocol';
import type {RoomCapabilityRuntime} from '../src/types';

type Listener = (event: {data?: unknown}) => void;

class FakeWebSocket {
  readyState = 0;
  sent: string[] = [];
  closed?: {code?: number; reason?: string};
  listeners = new Map<string, Set<Listener>>();

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed = {code, reason};
    this.readyState = 3;
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data?: unknown) {
    if (type === 'open') this.readyState = 1;
    for (const listener of this.listeners.get(type) ?? []) listener({data});
  }
}

function createRuntime(): RoomCapabilityRuntime {
  return {
    listTools: () => [],
    callTool: jest.fn(async () => ({ok: true, data: 'done'})),
    dispose: jest.fn(),
  };
}

describe('registerBrowserMcpBridge', () => {
  test('rejects an empty bridge token', () => {
    expect(() =>
      registerBrowserMcpBridge(createRuntime(), {
        url: 'ws://local',
        token: '',
        createWebSocket: () => new FakeWebSocket(),
      }),
    ).toThrow('token is required');
  });

  test('detaches stale sockets and reconnects only once', async () => {
    jest.useFakeTimers();
    const sockets: FakeWebSocket[] = [];
    const bridge = registerBrowserMcpBridge(createRuntime(), {
      url: 'ws://local',
      token: 'secret',
      pageId: 'page-a',
      reconnectMs: 5,
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
    });

    const first = sockets[0]!;
    first.emit('open');
    first.emit(
      'message',
      JSON.stringify({
        version: MCP_BRIDGE_PROTOCOL_VERSION,
        type: 'bridge.authenticated',
      }),
    );
    first.emit('close');
    first.emit('close');
    await jest.advanceTimersByTimeAsync(5);

    expect(sockets).toHaveLength(2);
    expect(first.listeners.get('close')?.size ?? 0).toBe(0);
    bridge.dispose();
    jest.useRealTimers();
  });

  test('sends bridge.gone before closing on dispose', () => {
    const socket = new FakeWebSocket();
    const bridge = registerBrowserMcpBridge(createRuntime(), {
      url: 'ws://local',
      token: 'secret',
      pageId: 'page-a',
      createWebSocket: () => socket,
    });
    socket.emit('open');

    bridge.dispose();

    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({
      type: 'bridge.gone',
      pageId: 'page-a',
    });
    expect(socket.closed).toEqual({code: 1000, reason: 'page disposed'});
  });
});
