import {createStore} from 'zustand';
import {z} from 'zod';
import {createBaseRoomSlice, BaseRoomStoreState} from '../src/BaseRoomStore';
import {
  CommandSliceState,
  CreateCommandSliceProps,
  createCommandSlice,
  getCommandKeystrokes,
  getCommandShortcut,
} from '../src/CommandSlice';

interface TestRoomState
  extends BaseRoomStoreState, CommandSliceState<TestRoomState> {
  features: {
    enabledCommands: string[];
  };
}

function createTestCommandStore(
  createCommandProps?: CreateCommandSliceProps<TestRoomState>,
  captureException = jest.fn(),
) {
  const store = createStore<TestRoomState>((set, get, roomStore) => ({
    ...createBaseRoomSlice({captureException})(set, get, roomStore),
    ...createCommandSlice<TestRoomState>(createCommandProps)(
      set,
      get,
      roomStore,
    ),
    features: {
      enabledCommands: [],
    },
  }));

  return {store, captureException};
}

describe('CommandSlice', () => {
  it('collects keystrokes from current and legacy fields', () => {
    const command = {
      ui: {
        keystrokes: ['Mod+Shift+T', 'Ctrl+Shift+T'],
        shortcut: 'Mod+Shift+T',
      },
      keystrokes: ['Alt+Shift+T', 'Ctrl+Shift+T'],
      shortcut: 'Ctrl+Shift+T',
    };

    expect(getCommandKeystrokes(command)).toEqual([
      'Mod+Shift+T',
      'Ctrl+Shift+T',
      'Alt+Shift+T',
    ]);
    expect(getCommandShortcut(command)).toBe('Mod+Shift+T');
  });

  it('ignores malformed non-string keystrokes at runtime', () => {
    const command = {
      ui: {
        keystrokes: ['  Mod+S  ', 42, '', 'Ctrl+S'],
      },
      keystrokes: [null, '  ', 'Alt+S'],
    } as any;

    expect(getCommandKeystrokes(command)).toEqual(['Mod+S', 'Ctrl+S', 'Alt+S']);
    expect(getCommandShortcut(command)).toBe('Mod+S');
  });

  it('includes keystrokes and shortcut in command descriptors', () => {
    const {store} = createTestCommandStore();

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.save',
      name: 'Save',
      ui: {
        keystrokes: ['Mod+S', 'Ctrl+S'],
      },
      execute: () => ({
        success: true,
        commandId: 'test.save',
      }),
    });

    const descriptors = store.getState().commands.listCommands();

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toMatchObject({
      id: 'test.save',
      keystrokes: ['Mod+S', 'Ctrl+S'],
      shortcut: 'Mod+S',
    });
  });

  it('runs command middleware in order and forwards validated input', async () => {
    const executionOrder: string[] = [];
    const middlewareInputs: unknown[] = [];

    const {store} = createTestCommandStore({
      middleware: [
        async (_command, input, _context, next) => {
          executionOrder.push('middleware-1-before');
          middlewareInputs.push(input);
          const result = await next();
          executionOrder.push('middleware-1-after');
          return result;
        },
        async (_command, input, _context, next) => {
          executionOrder.push('middleware-2-before');
          middlewareInputs.push(input);
          const result = await next();
          executionOrder.push('middleware-2-after');
          return result;
        },
      ],
    });

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.run',
      name: 'Run',
      inputSchema: z.object({
        count: z.coerce.number().int(),
      }),
      execute: (_context, input) => {
        executionOrder.push('execute');
        return {
          success: true,
          commandId: 'test.run',
          data: input,
        };
      },
    });

    const result = await store
      .getState()
      .commands.invokeCommand('test.run', {count: '3'});

    expect(result).toMatchObject({
      success: true,
      commandId: 'test.run',
      data: {
        count: 3,
      },
    });
    expect(middlewareInputs).toEqual([{count: 3}, {count: 3}]);
    expect(executionOrder).toEqual([
      'middleware-1-before',
      'middleware-2-before',
      'execute',
      'middleware-2-after',
      'middleware-1-after',
    ]);
  });

  it('allows middleware to short-circuit command execution', async () => {
    const executeSpy = jest.fn();
    const {store} = createTestCommandStore({
      middleware: [
        async (command) => {
          return {
            success: false,
            commandId: command.id,
            code: 'blocked-by-middleware',
            error: `Blocked ${command.id}`,
          };
        },
      ],
    });

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.blocked',
      name: 'Blocked command',
      execute: () => {
        executeSpy();
      },
    });

    const result = await store
      .getState()
      .commands.invokeCommand('test.blocked');

    expect(executeSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      commandId: 'test.blocked',
      code: 'blocked-by-middleware',
    });
  });

  it('fires invoke failure callback when command returns unsuccessful result', async () => {
    const onCommandInvokeSuccess = jest.fn();
    const onCommandInvokeFailure = jest.fn();
    const onCommandInvokeError = jest.fn();

    const {store} = createTestCommandStore({
      onCommandInvokeSuccess,
      onCommandInvokeFailure,
      onCommandInvokeError,
    });

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.failure-result',
      name: 'Failure result',
      execute: () => ({
        success: false,
        commandId: 'test.failure-result',
        code: 'not-allowed',
        error: 'not allowed',
      }),
    });

    const result = await store
      .getState()
      .commands.invokeCommand('test.failure-result');

    expect(result).toMatchObject({
      success: false,
      commandId: 'test.failure-result',
      code: 'not-allowed',
    });
    expect(onCommandInvokeFailure).toHaveBeenCalledTimes(1);
    expect(onCommandInvokeFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({id: 'test.failure-result'}),
        result: expect.objectContaining({success: false}),
        durationMs: expect.any(Number),
      }),
    );
    expect(onCommandInvokeSuccess).not.toHaveBeenCalled();
    expect(onCommandInvokeError).not.toHaveBeenCalled();
  });

  it('rejects middleware that calls next() multiple times', async () => {
    const executeSpy = jest.fn(() => ({
      success: true,
      commandId: 'test.next-once',
    }));

    const {store} = createTestCommandStore({
      middleware: [
        async (_command, _input, _context, next) => {
          await next();
          return await next();
        },
      ],
    });

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.next-once',
      name: 'Next once',
      execute: executeSpy,
    });

    const result = await store
      .getState()
      .commands.invokeCommand('test.next-once');

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: false,
      commandId: 'test.next-once',
      code: 'command-execution-error',
      error: 'Command middleware next() called multiple times.',
    });
  });

  it('fires command invoke telemetry callbacks for success and failure', async () => {
    const onCommandInvokeStart = jest.fn();
    const onCommandInvokeSuccess = jest.fn();
    const onCommandInvokeError = jest.fn();

    const {store} = createTestCommandStore({
      onCommandInvokeStart,
      onCommandInvokeSuccess,
      onCommandInvokeError,
    });

    store.getState().commands.registerCommands('test-owner', [
      {
        id: 'test.success',
        name: 'Success',
        execute: () => ({
          success: true,
          commandId: 'test.success',
        }),
      },
      {
        id: 'test.failure',
        name: 'Failure',
        execute: () => {
          throw new Error('boom');
        },
      },
    ]);

    const successResult = await store
      .getState()
      .commands.invokeCommand('test.success');
    const failedResult = await store
      .getState()
      .commands.invokeCommand('test.failure');

    expect(successResult.success).toBe(true);
    expect(failedResult).toMatchObject({
      success: false,
      code: 'command-execution-error',
      commandId: 'test.failure',
    });
    expect(onCommandInvokeStart).toHaveBeenCalledTimes(2);
    expect(onCommandInvokeSuccess).toHaveBeenCalledTimes(1);
    expect(onCommandInvokeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({id: 'test.success'}),
        durationMs: expect.any(Number),
      }),
    );
    expect(onCommandInvokeError).toHaveBeenCalledTimes(1);
    expect(onCommandInvokeError).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({id: 'test.failure'}),
        error: expect.any(Error),
        durationMs: expect.any(Number),
      }),
    );
  });

  it('captures telemetry callback errors without failing command execution', async () => {
    const captureException = jest.fn();
    const {store} = createTestCommandStore(
      {
        onCommandInvokeStart: () => {
          throw new Error('telemetry-failure');
        },
      },
      captureException,
    );

    store.getState().commands.registerCommand('test-owner', {
      id: 'test.telemetry',
      name: 'Telemetry test',
      execute: () => ({
        success: true,
        commandId: 'test.telemetry',
      }),
    });

    const result = await store
      .getState()
      .commands.invokeCommand('test.telemetry');

    expect(result.success).toBe(true);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({message: 'telemetry-failure'}),
    );
  });
});
