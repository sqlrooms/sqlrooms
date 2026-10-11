import {describe, expect, jest, test} from '@jest/globals';
import {createStore} from 'zustand/vanilla';
import {
  createBaseRoomSlice,
  createCommandMcpAdapter,
  createCommandSlice,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '../src';

type State = BaseRoomStoreState & CommandSliceState;

function createTestStore() {
  const execute = jest.fn(async () => ({success: true, commandId: 'danger'}));
  const store = createStore<State>()((...args) => ({
    ...createBaseRoomSlice<State>()(...args),
    ...createCommandSlice<State>()(...args),
  }));
  store.getState().commands.registerCommand('test', {
    id: 'danger',
    name: 'Danger',
    description: 'A dangerous action.',
    execute,
    metadata: {riskLevel: 'high', requiresConfirmation: true},
  });
  return {store, execute};
}

describe('createCommandMcpAdapter', () => {
  test('does not bypass confirmation policy', async () => {
    const {store, execute} = createTestStore();
    const adapter = createCommandMcpAdapter(store, {
      mapToolName: (id) => id,
    });
    await expect(adapter.callTool('danger')).resolves.toMatchObject({
      success: false,
      code: 'command-confirmation-required',
    });
    expect(execute).not.toHaveBeenCalled();

    await expect(
      adapter.callTool('danger', {}, {confirmed: true}),
    ).resolves.toMatchObject({success: true});
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('does not invoke a command after its caller is cancelled', async () => {
    const {store, execute} = createTestStore();
    const adapter = createCommandMcpAdapter(store, {
      mapToolName: (id) => id,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.callTool(
        'danger',
        {},
        {confirmed: true, signal: controller.signal},
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'command-cancelled',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
