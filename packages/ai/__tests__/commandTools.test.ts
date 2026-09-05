import {jest} from '@jest/globals';

const invokeCommandWithPolicy = jest.fn(
  (
    store: any,
    commandId: string,
    input: unknown,
    invocation: unknown,
    policy: unknown,
  ) => {
    void policy;
    return store
      .getState()
      .commands.invokeCommand(commandId, input, invocation);
  },
);

jest.unstable_mockModule('@sqlrooms/room-shell', () => ({
  hasCommandSliceState: () => true,
  invokeCommandWithPolicy,
}));

const {
  createCommandTools,
  GetCommandToolParameters,
  SearchCommandsToolParameters,
} = await import('../src/tools/commandTools');

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
    description: 'Rename an existing dashboard or block document artifact.',
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
    id: 'document.add-dashboard-block',
    owner: 'app',
    name: 'Add Dashboard Block',
    description: 'Add a dashboard block to a block document.',
    group: 'Block Document',
    keywords: ['block-document', 'dashboard', 'block', 'add'],
    enabled: true,
    visible: true,
    requiresInput: true,
    inputDescription: 'Block document id, dashboard title, and table.',
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

// Metadata from the command-discovery trace for the earthquake map.
const documentCommandDescriptors = [
  {
    id: 'document.insert-blocks',
    name: 'Insert document blocks',
    description: 'Insert top-level blocks into a Document artifact',
    keywords: ['document', 'insert', 'blocks'],
    readOnly: false,
  },
  {
    id: 'document.list',
    name: 'List documents',
    description: 'List Document artifacts in the room',
    keywords: ['document', 'document', 'blocks', 'list'],
    readOnly: true,
  },
  {
    id: 'document.get',
    name: 'Get document',
    description:
      'Read blocks from a Document artifact. Defaults to the current document artifact.',
    keywords: ['document', 'read', 'get', 'blocks'],
    readOnly: true,
  },
  {
    id: 'document.add-map-block',
    name: 'Add or update block document map block',
    description: 'Create or update a direct block document map block.',
    keywords: ['block document', 'map', 'deck', 'block', 'add', 'update'],
    readOnly: false,
  },
].map((descriptor) => ({
  ...commandDescriptors[0],
  group: 'Document',
  ...descriptor,
  requiresInput: !descriptor.readOnly,
}));

function createCommandState(
  invokeCommand: any,
  descriptors: readonly any[] = [],
  options?: any,
  extraState?: Record<string, unknown>,
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
        ...extraState,
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
  it.each([
    {query: 'nonexistent'},
    {query: 'nonexistent', resourceType: 'artifact', riskLevel: 'low'},
    {query: 'in'},
  ])('does not count unrelated commands as matches for %j', async (params) => {
    const tools = createCommandState(jest.fn(), commandDescriptors);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse(params),
    );

    expect(result).toMatchObject({
      success: true,
      commands: [],
      details: 'Found 0 matching commands.',
    });
  });

  it('reports the relevant count before limiting search results', async () => {
    const tools = createCommandState(jest.fn(), commandDescriptors);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({query: 'dashboard', limit: 1}),
    );

    expect(result.commands).toHaveLength(1);
    expect(result.details).toBe('Found 2 matching commands.');
  });

  it('matches whole words rather than unrelated substrings', async () => {
    const tools = createCommandState(jest.fn(), [
      {
        ...commandDescriptors[0],
        id: 'bitmap.export',
        name: 'Export bitmap',
        description: 'Export a bitmap image.',
        keywords: ['bitmap', 'export'],
      },
    ]);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({query: 'map'}),
    );

    expect(result.commands).toEqual([]);
  });

  it('supports empty searches and searches using only hints', async () => {
    const tools = createCommandState(jest.fn(), commandDescriptors);
    const all = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({}),
    );
    const hinted = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({resourceType: 'dashboard'}),
    );

    expect(all.commands).toHaveLength(3);
    expect(hinted.commands).toHaveLength(2);
    expect(hinted.commands.map((command: any) => command.id)).not.toContain(
      'artifact.delete',
    );
  });

  it.each([
    {query: 'get map block', resourceType: 'block-document', action: 'get'},
    {query: 'read map'},
    {query: 'map get'},
  ])(
    'ranks reading the document ahead of map mutations for %j',
    async (params) => {
      const tools = createCommandState(jest.fn(), [
        ...documentCommandDescriptors,
        ...commandDescriptors,
      ]);
      const result = await (tools.search_commands as any).execute(
        SearchCommandsToolParameters.parse(params),
      );

      expect(result.commands[0].id).toBe('document.get');
      expect(result.commands[0].matchReason).toContain('read-only command');
      expect(result.commands.map((command: any) => command.id)).not.toContain(
        'artifact.delete',
      );
    },
  );

  it('ranks document reads ahead of insertion for a natural-language list request', async () => {
    const tools = createCommandState(jest.fn(), documentCommandDescriptors);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({
        query: 'list blocks in document',
        resourceType: 'block-document',
        action: 'list',
      }),
    );

    expect(
      result.commands.slice(0, 2).map((command: any) => command.id),
    ).toEqual(['document.list', 'document.get']);
  });

  it('keeps exact command IDs first even with a conflicting read hint', async () => {
    const tools = createCommandState(jest.fn(), documentCommandDescriptors);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({
        query: 'document.add-map-block',
        action: 'get',
      }),
    );

    expect(result.commands[0].id).toBe('document.add-map-block');
  });

  it('keeps map authoring discoverable with an explicit write action', async () => {
    const tools = createCommandState(jest.fn(), documentCommandDescriptors);
    const result = await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({
        query: 'get map block',
        action: 'add',
      }),
    );

    expect(result.commands[0].id).toBe('document.add-map-block');
  });

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
      id: 'document.add-dashboard-block',
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

  it('omits denied commands from search, list, and command details', async () => {
    const guardedDescriptors = [
      commandDescriptors[0],
      {
        ...commandDescriptors[1],
        id: 'document.hidden-mutation',
        visible: false,
      },
      commandDescriptors[2],
    ] as const;
    const commandGuard = jest.fn((descriptor: {id: string}) => ({
      allowed: descriptor.id === 'artifact.rename',
    }));
    const tools = createCommandState(jest.fn(), guardedDescriptors, {
      commandGuard,
    });

    const searchResult = await (tools.search_commands as any).execute({
      query: '',
      includeHidden: true,
      includeDisabled: true,
      limit: 50,
    });
    const listResult = await (tools.list_commands as any).execute({
      includeInvisible: true,
      includeDisabled: true,
      includeInputSchema: true,
    });
    const hiddenGetResult = await (tools.get_command as any).execute({
      commandId: 'document.hidden-mutation',
      includeHidden: true,
      includeDisabled: true,
    });
    const disabledGetResult = await (tools.get_command as any).execute({
      commandId: 'artifact.delete',
      includeHidden: true,
      includeDisabled: true,
    });

    expect(searchResult.commands.map((command: any) => command.id)).toEqual([
      'artifact.rename',
    ]);
    expect(listResult.commands.map((command: any) => command.id)).toEqual([
      'artifact.rename',
    ]);
    expect(hiddenGetResult).toEqual({
      success: false,
      errorMessage: 'Unknown command ID "document.hidden-mutation".',
    });
    expect(disabledGetResult).toEqual({
      success: false,
      errorMessage: 'Unknown command ID "artifact.delete".',
    });
    expect(commandGuard).toHaveBeenCalledWith(
      expect.objectContaining({visible: false}),
    );
    expect(commandGuard).toHaveBeenCalledWith(
      expect.objectContaining({enabled: false}),
    );
  });

  it('returns a custom guard refusal before confirmation or invocation', async () => {
    invokeCommandWithPolicy.mockClear();
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.delete',
    }));
    const tools = createCommandState(invokeCommand, commandDescriptors, {
      commandGuard: (descriptor: {id: string}) =>
        descriptor.id === 'artifact.delete'
          ? {
              allowed: false,
              code: 'use-artifact-agent',
              message: 'Use the artifact agent to delete artifacts.',
            }
          : {allowed: true},
    });

    const result = await (tools.execute_command as any).execute({
      commandId: 'artifact.delete',
      input: {artifactId: 'artifact-1'},
    });

    expect(result).toEqual({
      success: false,
      commandId: 'artifact.delete',
      errorMessage: 'Use the artifact agent to delete artifacts.',
      result: {
        code: 'use-artifact-agent',
        message: 'Use the artifact agent to delete artifacts.',
      },
    });
    expect(invokeCommandWithPolicy).not.toHaveBeenCalled();
    expect(invokeCommand).not.toHaveBeenCalled();

    await invokeCommand('artifact.delete', {artifactId: 'artifact-1'});
    expect(invokeCommand).toHaveBeenCalledWith('artifact.delete', {
      artifactId: 'artifact-1',
    });
  });

  it('uses the default guard refusal when no reason is supplied', async () => {
    invokeCommandWithPolicy.mockClear();
    const invokeCommand = jest.fn();
    const tools = createCommandState(invokeCommand, commandDescriptors, {
      commandGuard: (descriptor: {id: string}) => ({
        allowed: descriptor.id !== 'document.add-dashboard-block',
      }),
    });

    const result = await (tools.execute_command as any).execute({
      commandId: 'document.add-dashboard-block',
    });

    expect(result).toEqual({
      success: false,
      commandId: 'document.add-dashboard-block',
      errorMessage:
        'Command "document.add-dashboard-block" is not available to this caller.',
      result: {
        code: 'command-not-available-to-caller',
        message:
          'Command "document.add-dashboard-block" is not available to this caller.',
      },
    });
    expect(invokeCommandWithPolicy).not.toHaveBeenCalled();
    expect(invokeCommand).not.toHaveBeenCalled();
  });

  it('preserves command behavior when the guard is omitted', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.rename',
    }));
    const tools = createCommandState(invokeCommand, commandDescriptors);

    const listResult = await (tools.list_commands as any).execute({
      includeInvisible: true,
      includeDisabled: true,
      includeInputSchema: true,
    });
    const executionResult = await (tools.execute_command as any).execute({
      commandId: 'artifact.rename',
      input: {title: 'Renamed'},
    });

    expect(listResult.commands).toEqual(commandDescriptors);
    expect(executionResult.success).toBe(true);
    expect(invokeCommand).toHaveBeenCalled();
  });

  it('honors the configured default surface for parsed discovery inputs', async () => {
    const invokeCommand = jest.fn();
    const listCommands = jest.fn(
      (listOptions?: {includeInputSchema?: boolean}) =>
        commandDescriptors.map((descriptor) =>
          listOptions?.includeInputSchema
            ? descriptor
            : {...descriptor, inputSchema: undefined},
        ),
    );
    const tools = createCommandTools(
      {
        getState: () => ({
          commands: {
            registerCommands: jest.fn(),
            unregisterCommands: jest.fn(),
            listCommands,
            getCommand: jest.fn(),
            executeCommand: jest.fn(),
            invokeCommand,
          },
        }),
      } as any,
      {defaultSurface: 'mcp'},
    );

    await (tools.search_commands as any).execute(
      SearchCommandsToolParameters.parse({query: 'rename'}),
    );
    await (tools.get_command as any).execute(
      GetCommandToolParameters.parse({commandId: 'artifact.rename'}),
    );

    expect(listCommands).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({surface: 'mcp'}),
    );
    expect(listCommands).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({surface: 'mcp'}),
    );
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
    expect(invokeCommandWithPolicy).toHaveBeenCalledWith(
      expect.anything(),
      'artifact.create',
      {title: 'Artifact'},
      expect.objectContaining({surface: 'ai'}),
      {confirmed: false},
    );
  });

  it('uses the mutable tool run context as the command target', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.create',
    }));
    const tools = createCommandState(invokeCommand);
    const contextA = {
      items: [
        {
          kind: 'artifact',
          id: 'artifact-a',
          type: 'document',
          title: 'Artifact A',
        },
      ],
      primaryItemId: 'artifact-a',
      primaryItemKind: 'artifact',
      capturedAt: 1,
    };
    const contextB = {
      items: [
        {
          kind: 'artifact',
          id: 'artifact-b',
          type: 'document',
          title: 'Artifact B',
        },
      ],
      primaryItemId: 'artifact-b',
      primaryItemKind: 'artifact',
      capturedAt: 2,
    };
    let currentRunContext = contextA;
    const executionContext = {
      sessionId: 'session-a',
      aiRunContext: contextB,
      getAiRunContext: () => currentRunContext,
    };

    await (tools.execute_command as any).execute(
      {commandId: 'artifact.create'},
      executionContext,
    );
    currentRunContext = contextB;
    await (tools.execute_command as any).execute(
      {commandId: 'artifact.create'},
      executionContext,
    );

    expect(invokeCommand).toHaveBeenNthCalledWith(
      1,
      'artifact.create',
      undefined,
      expect.objectContaining({
        surface: 'ai',
        target: {kind: 'artifact', id: 'artifact-a'},
      }),
    );
    expect(invokeCommand).toHaveBeenNthCalledWith(
      2,
      'artifact.create',
      undefined,
      expect.objectContaining({
        surface: 'ai',
        target: {kind: 'artifact', id: 'artifact-b'},
      }),
    );
  });

  it('falls back to the invoking session run context without using the current session', async () => {
    const invokeCommand = jest.fn(async () => ({
      success: true,
      commandId: 'artifact.create',
    }));
    const getCurrentSession = jest.fn(() => ({id: 'session-b'}));
    const getSessionRunContext = jest.fn((sessionId: string) =>
      sessionId === 'session-a'
        ? {
            items: [
              {
                kind: 'artifact',
                id: 'artifact-a',
                type: 'document',
                title: 'Artifact A',
              },
            ],
            primaryItemId: 'artifact-a',
            primaryItemKind: 'artifact',
            capturedAt: 1,
          }
        : undefined,
    );
    const tools = createCommandState(invokeCommand, [], undefined, {
      ai: {getCurrentSession, getSessionRunContext},
    });

    await (tools.execute_command as any).execute(
      {commandId: 'artifact.create'},
      {sessionId: 'session-a'},
    );

    expect(getSessionRunContext).toHaveBeenCalledWith('session-a');
    expect(getCurrentSession).not.toHaveBeenCalled();
    expect(invokeCommand).toHaveBeenCalledWith(
      'artifact.create',
      undefined,
      expect.objectContaining({
        surface: 'ai',
        target: {kind: 'artifact', id: 'artifact-a'},
        metadata: {aiSessionId: 'session-a'},
      }),
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
