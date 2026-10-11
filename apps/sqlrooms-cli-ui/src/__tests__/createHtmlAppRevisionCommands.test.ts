import {jest} from '@jest/globals';
import {
  HTML_APP_RENAME_COMMAND_ID,
  HTML_APP_UNDO_REVISION_COMMAND_ID,
  HTML_APP_WRITE_REVISION_COMMAND_ID,
} from '@sqlrooms/app-runtime';
import {createHtmlAppRevisionCommands} from '../createHtmlAppRevisionCommands';

function createCommandContext(
  state: unknown,
  invocation: {
    surface: 'ai' | 'unknown';
    target?: {kind: string; id: string};
  } = {surface: 'unknown'},
) {
  return {
    getState: () => state as any,
    store: {getState: () => state} as any,
    invocation,
  };
}

function getCommand(id: string) {
  const command = createHtmlAppRevisionCommands().find(
    (candidate) => candidate.id === id,
  );
  if (!command) {
    throw new Error(`Missing command "${id}".`);
  }
  return command;
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
  const commitAppRevision = jest.fn(
    (_appId: string, patch: any, metadata: any) => {
      Object.assign(app, patch);
      const revision = {
        id: metadata?.revisionId ?? 'revision-1',
        name: metadata?.name ?? 'Revision',
        description: metadata?.description,
        source: metadata?.source ?? 'assistant',
        sourcePrompt: metadata?.sourcePrompt,
        createdAt: metadata?.createdAt ?? 2,
        files: app.files,
        entryHtmlPath: app.entryHtmlPath,
        dependencies: app.dependencies,
      };
      app.revisions.push(revision);
      app.activeRevisionId = revision.id;
      return revision;
    },
  );
  const renameApp = jest.fn((_appId: string, title: string) => {
    app.title = title;
  });
  const state = {
    htmlApps: {
      getApp: (appId: string) => (appId === app.id ? app : undefined),
      commitAppRevision,
      renameApp,
    },
    artifacts: {
      config: {currentArtifactId: undefined, artifactsById: {}},
    },
  };
  return {app, state, commitAppRevision, renameApp};
}

describe('createHtmlAppRevisionCommands', () => {
  it('writes committed HTML app revisions with metadata', async () => {
    const {state, commitAppRevision} = createState();

    const result = await getCommand(HTML_APP_WRITE_REVISION_COMMAND_ID).execute(
      createCommandContext(state),
      {
        appId: 'app-1',
        patch: {
          title: 'Updated App',
          files: {'/index.html': '<html><title>Updated App</title></html>'},
          diagnostics: [],
        },
        metadata: {
          name: 'Generated app',
          source: 'assistant',
          sourcePrompt: 'build an app',
        },
      },
    );

    expect(commitAppRevision).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({title: 'Updated App'}),
      expect.objectContaining({
        name: 'Generated app',
        sourcePrompt: 'build an app',
      }),
    );
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

  it('renames HTML apps directly when no source files are committed', async () => {
    const {state, renameApp, commitAppRevision} = createState();

    const result = await getCommand(HTML_APP_RENAME_COMMAND_ID).execute(
      createCommandContext(state),
      {appId: 'app-1', title: 'Renamed App'},
    );

    expect(renameApp).toHaveBeenCalledWith('app-1', 'Renamed App');
    expect(commitAppRevision).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Renamed App',
      },
    });
  });

  it('commits metadata-backed title-only renames as revisions', async () => {
    const {state, renameApp, commitAppRevision} = createState();

    const result = await getCommand(HTML_APP_RENAME_COMMAND_ID).execute(
      createCommandContext(state),
      {
        appId: 'app-1',
        title: 'Audited App',
        metadata: {name: 'Rename to Audited App', source: 'assistant'},
      },
    );

    expect(renameApp).not.toHaveBeenCalled();
    expect(commitAppRevision).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        title: 'Audited App',
      }),
      expect.objectContaining({
        name: 'Rename to Audited App',
        source: 'assistant',
      }),
    );
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Audited App',
        revisionId: 'revision-1',
      },
    });
  });

  it('uses the AI invocation artifact for optional revision targets', async () => {
    const created = createState();
    const state = created.state as any;
    const appA = created.app;
    const appB = {...appA, id: 'app-2', title: 'App 2', revisions: []};
    const revision = {
      id: 'revision-1',
      name: 'Previous',
      source: 'assistant',
      createdAt: 2,
      files: appA.files,
      entryHtmlPath: appA.entryHtmlPath,
      dependencies: appA.dependencies,
    };
    const undoAppRevision = jest.fn(() => revision);
    state.htmlApps.config = {appsById: {'app-1': appA, 'app-2': appB}};
    state.htmlApps.getApp = (appId: string) =>
      state.htmlApps.config.appsById[appId];
    state.htmlApps.undoAppRevision = undoAppRevision;
    state.artifacts.config = {
      currentArtifactId: 'app-2',
      artifactsById: {
        'app-1': {id: 'app-1', type: 'html-app', title: 'App'},
        'app-2': {id: 'app-2', type: 'html-app', title: 'App 2'},
      },
    };
    const command = getCommand(HTML_APP_UNDO_REVISION_COMMAND_ID);

    await command.execute(
      createCommandContext(state, {
        surface: 'ai',
        target: {kind: 'artifact', id: 'app-1'},
      }),
      {},
    );
    await command.execute(
      createCommandContext(state, {
        surface: 'ai',
        target: {kind: 'artifact', id: 'app-1'},
      }),
      {appId: 'app-2'},
    );
    await command.execute(createCommandContext(state), {});

    expect(undoAppRevision).toHaveBeenNthCalledWith(1, 'app-1');
    expect(undoAppRevision).toHaveBeenNthCalledWith(2, 'app-2');
    expect(undoAppRevision).toHaveBeenNthCalledWith(3, 'app-2');
  });

  it('renames HTML apps through a revision when updated files are provided', async () => {
    const {state, renameApp, commitAppRevision} = createState();

    const result = await getCommand(HTML_APP_RENAME_COMMAND_ID).execute(
      createCommandContext(state),
      {
        appId: 'app-1',
        title: 'Source Renamed App',
        files: {
          '/index.html': '<html><title>Source Renamed App</title></html>',
        },
        metadata: {name: 'Rename app title', source: 'assistant'},
      },
    );

    expect(renameApp).not.toHaveBeenCalled();
    expect(commitAppRevision).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        title: 'Source Renamed App',
        diagnostics: [],
      }),
      expect.objectContaining({name: 'Rename app title'}),
    );
    expect(result).toMatchObject({
      success: true,
      commandId: HTML_APP_RENAME_COMMAND_ID,
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Source Renamed App',
        revisionId: 'revision-1',
      },
    });
  });
});
