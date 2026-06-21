import {jest} from '@jest/globals';

jest.unstable_mockModule('@sqlrooms/room-shell', () => ({
  hasCommandSliceState: () => true,
}));

const {createCommandTools} = await import('../src/tools/commandTools');

function createCommandState(invokeCommand: any) {
  return createCommandTools({
    getState: () => ({
      commands: {
        registerCommands: jest.fn(),
        unregisterCommands: jest.fn(),
        listCommands: jest.fn(() => []),
        getCommand: jest.fn(() => ({id: 'artifact.create'})),
        executeCommand: jest.fn(),
        invokeCommand,
      },
    }),
  } as any);
}

describe('command tools', () => {
  it('passes the owning AI session id through command invocation metadata', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.create',
      data: {artifactId: 'artifact-1'},
    }));
    const tools = createCommandState(invokeCommand);

    await (tools.execute_command as any).execute(
      {commandId: 'artifact.create', input: {title: 'Artifact'}},
      {sessionId: 'session-1'},
    );

    expect(invokeCommand).toHaveBeenCalledWith(
      'artifact.create',
      {title: 'Artifact'},
      {
        surface: 'ai',
        metadata: {aiSessionId: 'session-1'},
      },
    );
  });
});
