import {jest} from '@jest/globals';

jest.unstable_mockModule('@sqlrooms/room-shell', () => ({
  hasCommandSliceState: () => true,
}));

const {createCommandTools} = await import('../src/tools/commandTools');

const inputSchema = {
  type: 'object',
  properties: {
    title: {type: 'string'},
  },
  required: ['title'],
};

const commandDescriptors = [
  {
    id: 'artifact.rename',
    owner: 'app',
    name: 'Rename Artifact',
    description: 'Rename an existing dashboard or worksheet artifact.',
    group: 'Artifacts',
    keywords: ['artifact', 'title', 'rename'],
    enabled: true,
    visible: true,
    requiresInput: true,
    inputDescription: 'Artifact id and title.',
    inputSchema,
    keystrokes: [],
    readOnly: false,
    idempotent: true,
    riskLevel: 'low',
    requiresConfirmation: false,
  },
  {
    id: 'worksheet.add-dashboard-block',
    owner: 'app',
    name: 'Add Dashboard Block',
    description: 'Add a dashboard block to a worksheet.',
    group: 'Worksheet',
    keywords: ['worksheet', 'dashboard', 'block', 'add'],
    enabled: true,
    visible: true,
    requiresInput: true,
    inputDescription: 'Worksheet id, dashboard title, and table.',
    inputSchema,
    keystrokes: [],
    readOnly: false,
    idempotent: false,
    riskLevel: 'medium',
    requiresConfirmation: false,
  },
  {
    id: 'artifact.delete',
    owner: 'app',
    name: 'Delete Artifact',
    description: 'Remove an artifact from the workspace.',
    group: 'Artifacts',
    keywords: ['artifact', 'remove', 'delete'],
    enabled: false,
    visible: true,
    requiresInput: true,
    inputDescription: 'Artifact id.',
    inputSchema,
    keystrokes: [],
    readOnly: false,
    idempotent: false,
    riskLevel: 'high',
    requiresConfirmation: true,
  },
] as const;

function createCommandState(
  invokeCommand: any,
  descriptors: readonly any[] = [],
  options?: any,
) {
  const listCommands = jest.fn((listOptions?: {includeInputSchema?: boolean}) =>
    descriptors.map((descriptor) =>
      listOptions?.includeInputSchema
        ? descriptor
        : {...descriptor, inputSchema: undefined},
    ),
  );
  const getCommand = jest.fn(
    (commandId: string) =>
      descriptors.find((descriptor) => descriptor.id === commandId) ??
      (commandId === 'artifact.create' ? {id: 'artifact.create'} : undefined),
  );
  return createCommandTools(
    {
      getState: () => ({
        commands: {
          registerCommands: jest.fn(),
          unregisterCommands: jest.fn(),
          listCommands,
          getCommand,
          executeCommand: jest.fn(),
          invokeCommand,
        },
      }),
    } as any,
    options,
  );
}

describe('command tools', () => {
  it('searches commands by intent with deterministic ranking', async () => {
    const tools = createCommandState(jest.fn(), commandDescriptors);

    const result = await (tools.search_commands as any).execute({
      query: 'rename artifact title',
      limit: 2,
    });

    expect(result.success).toBe(true);
    expect(result.commands.map((command: any) => command.id)).toEqual([
      'artifact.rename',
      'artifact.delete',
    ]);
    expect(result.commands[0].score).toBeGreaterThan(result.commands[1].score);
  });

  it('keeps command search compact by omitting schemas by default', async () => {
    const tools = createCommandState(jest.fn(), commandDescriptors);

    const result = await (tools.search_commands as any).execute({
      query: 'dashboard block',
    });

    expect(result.success).toBe(true);
    expect(result.commands[0]).toMatchObject({
      id: 'worksheet.add-dashboard-block',
      requiresInput: true,
      riskLevel: 'medium',
      enabled: true,
      visible: true,
      matchReason: expect.any(String),
    });
    expect(result.commands[0]).not.toHaveProperty('inputSchema');
    expect(result.commands[0]).not.toHaveProperty('owner');
    expect(result.commands[0]).not.toHaveProperty('inputDescription');
  });

  it('flags weak command metadata that can hurt search quality', async () => {
    const tools = createCommandState(jest.fn(), [
      {
        ...commandDescriptors[0],
        description: undefined,
        keywords: [],
      },
    ]);

    const result = await (tools.search_commands as any).execute({
      query: 'artifact.rename',
    });

    expect(result.commands[0]).toMatchObject({
      id: 'artifact.rename',
      metadataWarnings: ['missing description', 'missing keywords'],
    });
  });

  it('loads the selected command schema through get_command', async () => {
    const tools = createCommandState(jest.fn(), commandDescriptors);

    const result = await (tools.get_command as any).execute({
      commandId: 'artifact.rename',
    });

    expect(result).toMatchObject({
      success: true,
      command: {
        id: 'artifact.rename',
        inputSchema,
      },
    });
  });

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

  it('propagates skill trace metadata through command invocation options', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.rename',
      data: {artifactId: 'artifact-1'},
    }));
    const tools = createCommandState(invokeCommand, commandDescriptors, {
      defaultActor: 'skill-runtime',
      defaultMetadata: {runtime: 'skill'},
    });

    await (tools.execute_command as any).execute(
      {commandId: 'artifact.rename', input: {title: 'Artifact'}},
      {
        sessionId: 'session-1',
        skillId: 'skill-1',
        toolCallId: 'call-1',
        traceId: 'trace-1',
        metadata: {step: 'rename'},
      },
    );

    expect(invokeCommand).toHaveBeenCalledWith(
      'artifact.rename',
      {title: 'Artifact'},
      {
        surface: 'ai',
        actor: 'skill-runtime',
        traceId: 'trace-1',
        metadata: {
          runtime: 'skill',
          step: 'rename',
          aiSessionId: 'session-1',
          skillId: 'skill-1',
          toolCallId: 'call-1',
        },
      },
    );
  });

  it('requires explicit confirmation before executing high-risk commands', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.delete',
    }));
    const tools = createCommandState(invokeCommand, commandDescriptors);

    const blocked = await (tools.execute_command as any).execute({
      commandId: 'artifact.delete',
      input: {artifactId: 'artifact-1'},
    });

    expect(blocked).toMatchObject({
      success: false,
      commandId: 'artifact.delete',
      result: {code: 'command-confirmation-required'},
    });
    expect(invokeCommand).not.toHaveBeenCalled();

    const confirmed = await (tools.execute_command as any).execute({
      commandId: 'artifact.delete',
      input: {artifactId: 'artifact-1'},
      confirmed: true,
    });

    expect(confirmed.success).toBe(true);
    expect(invokeCommand).toHaveBeenCalled();
  });
});
