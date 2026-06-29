import {jest} from '@jest/globals';
import {createHtmlAppRevisionCommands} from '../createHtmlAppRevisionCommands';

function createCommandContext(state: unknown) {
  return {
    getState: () => state as any,
    store: {getState: () => state} as any,
    invocation: {surface: 'unknown' as const},
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

    const result = await getCommand('html-app.write-revision').execute(
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
      commandId: 'html-app.write-revision',
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

    const result = await getCommand('html-app.rename').execute(
      createCommandContext(state),
      {appId: 'app-1', title: 'Renamed App'},
    );

    expect(renameApp).toHaveBeenCalledWith('app-1', 'Renamed App');
    expect(commitAppRevision).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      commandId: 'html-app.rename',
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Renamed App',
      },
    });
  });

  it('commits metadata-backed title-only renames as revisions', async () => {
    const {state, renameApp, commitAppRevision} = createState();

    const result = await getCommand('html-app.rename').execute(
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
      commandId: 'html-app.rename',
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Audited App',
        revisionId: 'revision-1',
      },
    });
  });

  it('renames HTML apps through a revision when updated files are provided', async () => {
    const {state, renameApp, commitAppRevision} = createState();

    const result = await getCommand('html-app.rename').execute(
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
      commandId: 'html-app.rename',
      data: {
        appId: 'app-1',
        previousTitle: 'App',
        title: 'Source Renamed App',
        revisionId: 'revision-1',
      },
    });
  });
});
