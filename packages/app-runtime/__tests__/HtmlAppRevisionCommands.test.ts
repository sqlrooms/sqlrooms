import {
  HTML_APP_REDO_REVISION_COMMAND_ID,
  HTML_APP_RENAME_COMMAND_ID,
  HTML_APP_RESTORE_REVISION_COMMAND_ID,
  HTML_APP_UNDO_REVISION_COMMAND_ID,
  HTML_APP_WRITE_REVISION_COMMAND_ID,
  createHtmlAppRevisionCommands,
} from '../src/HtmlAppRevisionCommands';

function createCommandContext(state: unknown) {
  return {
    getState: () => state as any,
    store: {getState: () => state} as any,
    invocation: {surface: 'unknown' as const},
  };
}

function createState() {
  const app: any = {
    id: 'app-1',
    title: 'App',
    files: {'/index.html': '<html><title>App</title></html>'},
    entryHtmlPath: '/index.html',
    dependencies: [],
    diagnostics: [],
    revisions: [],
    activeRevisionId: undefined,
    redoRevisionIds: [],
    requestedCapabilities: ['query'],
    grantedCapabilities: ['query'],
    createdAt: 1,
    updatedAt: 1,
  };
  const revision = {
    id: 'revision-1',
    name: 'Initial',
    source: 'assistant',
    createdAt: 2,
    files: app.files,
    entryHtmlPath: app.entryHtmlPath,
    dependencies: app.dependencies,
  };
  const state = {appsById: {'app-1': app}, currentAppId: undefined};
  const renameHtmlApp = jest.fn((roomState, appId, title) => {
    roomState.appsById[appId]!.title = title;
  });
  const commitHtmlAppRevision = jest.fn(
    (_roomState, appId, patch, metadata) => {
      Object.assign(state.appsById[appId]!, patch);
      return {...revision, ...metadata};
    },
  );
  const restoreHtmlAppRevision = jest.fn(() => revision);
  const undoHtmlAppRevision = jest.fn(() => revision);
  const redoHtmlAppRevision = jest.fn(() => revision);
  return {
    app,
    revision,
    state,
    renameHtmlApp,
    commitHtmlAppRevision,
    restoreHtmlAppRevision,
    undoHtmlAppRevision,
    redoHtmlAppRevision,
    commands: createHtmlAppRevisionCommands<typeof state>({
      resolveCurrentAppId: (roomState) => roomState.currentAppId,
      getHtmlAppIds: (roomState) => Object.keys(roomState.appsById),
      getHtmlAppState: (roomState, appId) => roomState.appsById[appId],
      renameHtmlApp,
      commitHtmlAppRevision: commitHtmlAppRevision as any,
      restoreHtmlAppRevision: restoreHtmlAppRevision as any,
      undoHtmlAppRevision: undoHtmlAppRevision as any,
      redoHtmlAppRevision: redoHtmlAppRevision as any,
      ambiguousTargetMessage: 'Select a target app.',
    }),
  };
}

function getCommand(
  commands: ReturnType<typeof createHtmlAppRevisionCommands>,
  id: string,
) {
  const command = commands.find((candidate) => candidate.id === id);
  if (!command) {
    throw new Error(`Missing command "${id}".`);
  }
  return command;
}

describe('createHtmlAppRevisionCommands', () => {
  it('exports canonical HTML app revision command IDs', () => {
    const {commands} = createState();

    expect(commands.map((command) => command.id)).toEqual([
      HTML_APP_WRITE_REVISION_COMMAND_ID,
      HTML_APP_RENAME_COMMAND_ID,
      HTML_APP_RESTORE_REVISION_COMMAND_ID,
      HTML_APP_UNDO_REVISION_COMMAND_ID,
      HTML_APP_REDO_REVISION_COMMAND_ID,
    ]);
  });

  it('writes revisions through host callbacks', async () => {
    const {commands, state} = createState();

    const result = await getCommand(
      commands,
      HTML_APP_WRITE_REVISION_COMMAND_ID,
    ).execute(createCommandContext(state), {
      appId: 'app-1',
      patch: {title: 'Updated App'},
      metadata: {name: 'Generated app'},
    });

    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_WRITE_REVISION_COMMAND_ID,
      data: {
        appId: 'app-1',
        title: 'Updated App',
        revisionId: 'revision-1',
        revisionName: 'Generated app',
      },
    });
  });

  it('renames apps directly when no revision inputs are provided', async () => {
    const {commands, state, renameHtmlApp, commitHtmlAppRevision} =
      createState();

    const result = await getCommand(
      commands,
      HTML_APP_RENAME_COMMAND_ID,
    ).execute(createCommandContext(state), {
      appId: 'app-1',
      title: 'Renamed App',
    });

    expect(renameHtmlApp).toHaveBeenCalledWith(state, 'app-1', 'Renamed App');
    expect(commitHtmlAppRevision).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Renamed App',
      },
    });
    expect((result as any).code).toBeUndefined();
    expect((result as any).data.revisionId).toBeUndefined();
    expect((result as any).data.revisionName).toBeUndefined();
  });

  it('commits revision-backed renames when metadata is provided', async () => {
    const {commands, state, renameHtmlApp, commitHtmlAppRevision} =
      createState();

    const result = await getCommand(
      commands,
      HTML_APP_RENAME_COMMAND_ID,
    ).execute(createCommandContext(state), {
      appId: 'app-1',
      title: 'Audited App',
      metadata: {name: 'Rename to Audited App', source: 'assistant'},
    });

    expect(renameHtmlApp).not.toHaveBeenCalled();
    expect(commitHtmlAppRevision).toHaveBeenCalledWith(
      state,
      'app-1',
      expect.objectContaining({title: 'Audited App'}),
      expect.objectContaining({name: 'Rename to Audited App'}),
    );
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Audited App',
        revisionId: 'revision-1',
        revisionName: 'Rename to Audited App',
      },
    });
    expect((result as any).code).toBeUndefined();
  });

  it('commits revision-backed renames when files are provided without a title change', async () => {
    const {commands, state, renameHtmlApp, commitHtmlAppRevision} =
      createState();
    const files = {'/index.html': '<html><title>App</title><main /></html>'};

    const result = await getCommand(
      commands,
      HTML_APP_RENAME_COMMAND_ID,
    ).execute(createCommandContext(state), {
      appId: 'app-1',
      title: 'App',
      files,
    });

    expect(renameHtmlApp).not.toHaveBeenCalled();
    expect(commitHtmlAppRevision).toHaveBeenCalledWith(
      state,
      'app-1',
      expect.objectContaining({
        title: 'App',
        files,
        diagnostics: [],
      }),
      expect.objectContaining({}),
    );
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'App',
        revisionId: 'revision-1',
        revisionName: 'Initial',
      },
    });
    expect((result as any).code).toBeUndefined();
  });

  it('reports unchanged titles without renaming or committing revisions', async () => {
    const {commands, state, renameHtmlApp, commitHtmlAppRevision} =
      createState();

    const result = await getCommand(
      commands,
      HTML_APP_RENAME_COMMAND_ID,
    ).execute(createCommandContext(state), {
      appId: 'app-1',
      title: 'App',
    });

    expect(renameHtmlApp).not.toHaveBeenCalled();
    expect(commitHtmlAppRevision).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      code: 'html-app-title-unchanged',
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'App',
      },
    });
    expect((result as any).data.revisionId).toBeUndefined();
    expect((result as any).data.revisionName).toBeUndefined();
  });

  it('resolves the current app for restore, undo, and redo commands', async () => {
    const {commands, state, revision} = createState();
    state.currentAppId = 'app-1';

    for (const commandId of [
      HTML_APP_RESTORE_REVISION_COMMAND_ID,
      HTML_APP_UNDO_REVISION_COMMAND_ID,
      HTML_APP_REDO_REVISION_COMMAND_ID,
    ]) {
      const input =
        commandId === HTML_APP_RESTORE_REVISION_COMMAND_ID
          ? {revisionId: revision.id}
          : {};
      const result = await getCommand(commands, commandId).execute(
        createCommandContext(state),
        input,
      );

      expect(result).toMatchObject({
        success: true,
        commandId,
        data: {appId: 'app-1', revisionId: revision.id},
      });
    }
  });
});
