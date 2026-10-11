import {createAppClient} from '../src/client';
import {
  createBridgeHost,
  createDiagnosticPreludeScript,
  sanitizeDiagnosticDetail,
} from '../src/host';
import {APP_RUNTIME_MESSAGE_TYPE, RuntimeMessage} from '../src/protocol';

type MessageListener = (event: MessageEvent) => void;

class FakeWindow {
  private listeners = new Set<MessageListener>();

  addEventListener(type: string, listener: MessageListener) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MessageListener) {
    if (type === 'message') this.listeners.delete(listener);
  }

  dispatch(data: unknown, source: Window) {
    for (const listener of this.listeners) {
      listener({data, source} as MessageEvent);
    }
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function createWindowPair() {
  const app = new FakeWindow();
  const host = new FakeWindow();

  const appProxy = {
    postMessage: (data: unknown) => app.dispatch(data, hostProxy as Window),
  } as Window;
  const hostProxy = {
    postMessage: (data: unknown) => host.dispatch(data, appProxy),
  } as Window;

  return {
    app: app as unknown as Window & FakeWindow,
    host: host as unknown as Window & FakeWindow,
    appProxy,
    hostProxy,
  };
}

describe('app runtime bridge', () => {
  it('round-trips query requests through postMessage', async () => {
    const windows = createWindowPair();
    const host = createBridgeHost({
      currentWindow: windows.host,
      targetWindow: windows.appProxy,
      capabilities: {query: true},
      handlers: {
        query: async ({sql}) => ({
          rows: [{answer: 42, sql}],
          columns: [{name: 'answer'}, {name: 'sql'}],
          rowCount: 1,
          truncated: false,
        }),
      },
    });
    const client = createAppClient({
      currentWindow: windows.app,
      targetWindow: windows.hostProxy,
    });

    await expect(client.query('select 42 as answer')).resolves.toEqual({
      rows: [{answer: 42, sql: 'select 42 as answer'}],
      columns: [{name: 'answer'}, {name: 'sql'}],
      rowCount: 1,
      truncated: false,
    });

    client.dispose();
    host.dispose();
  });

  it('rejects denied capabilities with a structured error', async () => {
    const windows = createWindowPair();
    const host = createBridgeHost({
      currentWindow: windows.host,
      targetWindow: windows.appProxy,
      capabilities: {},
      handlers: {
        query: async () => ({
          rows: [],
          columns: [],
          rowCount: 0,
          truncated: false,
        }),
      },
    });
    const client = createAppClient({
      currentWindow: windows.app,
      targetWindow: windows.hostProxy,
    });

    await expect(client.query('select 1')).rejects.toMatchObject({
      code: 'capability_denied',
    });

    client.dispose();
    host.dispose();
  });

  it('responds to unknown methods with method_not_found', async () => {
    const windows = createWindowPair();
    const responses: unknown[] = [];
    windows.app.addEventListener('message', (event) =>
      responses.push(event.data),
    );
    const host = createBridgeHost({
      currentWindow: windows.host,
      targetWindow: windows.appProxy,
      capabilities: {query: true},
    });

    windows.host.dispatch(
      {
        type: APP_RUNTIME_MESSAGE_TYPE,
        version: 1,
        direction: 'request',
        id: 'request-1',
        method: 'mutate',
      },
      windows.appProxy,
    );

    expect(RuntimeMessage.parse(responses[0])).toMatchObject({
      direction: 'response',
      id: 'request-1',
      ok: false,
      error: {code: 'method_not_found'},
    });

    host.dispose();
  });

  it('times out pending client requests', async () => {
    const windows = createWindowPair();
    const client = createAppClient({
      currentWindow: windows.app,
      targetWindow: windows.hostProxy,
      requestTimeoutMs: 1,
    });

    await expect(client.query('select 1')).rejects.toMatchObject({
      code: 'timeout',
    });

    client.dispose();
  });

  it('captures diagnostics and removes listeners on dispose', () => {
    const windows = createWindowPair();
    const diagnostics: unknown[] = [];
    const host = createBridgeHost({
      currentWindow: windows.host,
      targetWindow: windows.appProxy,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    windows.host.dispatch(
      {
        type: APP_RUNTIME_MESSAGE_TYPE,
        version: 1,
        direction: 'diagnostic',
        diagnostic: {
          level: 'warn',
          source: 'console',
          message: 'careful',
        },
      },
      windows.appProxy,
    );

    expect(diagnostics).toMatchObject([
      {level: 'warn', source: 'console', message: 'careful'},
    ]);
    expect(windows.host.listenerCount).toBe(1);
    host.dispose();
    expect(windows.host.listenerCount).toBe(0);
  });

  it('sanitizes diagnostics before exposing them to the host', () => {
    const windows = createWindowPair();
    const diagnostics: unknown[] = [];
    const host = createBridgeHost({
      currentWindow: windows.host,
      targetWindow: windows.appProxy,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    windows.host.dispatch(
      {
        type: APP_RUNTIME_MESSAGE_TYPE,
        version: 1,
        direction: 'diagnostic',
        diagnostic: {
          level: 'error',
          source: 'console',
          message: 'Query error: TypeError: boom',
          detail: ['Query error:', new TypeError('boom'), 12n],
        },
      },
      windows.appProxy,
    );

    expect(diagnostics).toMatchObject([
      {
        detail: ['Query error:', {name: 'TypeError', message: 'boom'}, '12n'],
      },
    ]);
    host.dispose();
  });

  it('sanitizes circular diagnostic details', () => {
    const detail: Record<string, unknown> = {count: 1n};
    detail.self = detail;

    expect(sanitizeDiagnosticDetail(detail)).toEqual({
      count: '1n',
      self: '[Circular]',
    });
  });

  it('creates a diagnostic prelude with the global client and listeners', () => {
    const script = createDiagnosticPreludeScript({
      globalName: 'sqlrooms',
      targetOrigin: 'https://host.example',
    });

    expect(script).toContain('window[GLOBAL_NAME]');
    expect(script).toContain('unhandledrejection');
    expect(script).toContain('securitypolicyviolation');
    expect(script).toContain('https://host.example');
  });
});
