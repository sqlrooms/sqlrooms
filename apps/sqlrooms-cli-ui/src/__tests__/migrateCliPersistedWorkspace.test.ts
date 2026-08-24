import {migrateCliPersistedWorkspace} from '../migrateCliPersistedWorkspace';

type PersistedWorkspaceFixture = {
  artifacts: {
    artifactsById: Record<string, {id: string; type: string; title: string}>;
  };
  documents: {
    artifacts: Record<string, {id: string; markdown: string}>;
  };
  blockDocuments: {
    artifacts: Record<string, {id: string; content: unknown}>;
  };
};

function persistedWorkspace(): PersistedWorkspaceFixture {
  return {
    artifacts: {
      artifactsById: {
        legacyBlockDocument: {
          id: 'legacyBlockDocument',
          type: 'worksheet',
          title: 'Legacy block document',
        },
        legacyMarkdown: {
          id: 'legacyMarkdown',
          type: 'document',
          title: 'Legacy Markdown',
        },
        currentDocument: {
          id: 'currentDocument',
          type: 'document',
          title: 'Current Document',
        },
        currentMarkdown: {
          id: 'currentMarkdown',
          type: 'markdown',
          title: 'Current Markdown',
        },
        orphanedLegacyMarkdown: {
          id: 'orphanedLegacyMarkdown',
          type: 'document',
          title: 'Orphaned legacy Markdown',
        },
        dashboard: {id: 'dashboard', type: 'dashboard', title: 'Dashboard'},
      },
    },
    documents: {
      artifacts: {
        legacyMarkdown: {id: 'legacyMarkdown', markdown: '# Legacy'},
        currentMarkdown: {id: 'currentMarkdown', markdown: '# Current'},
        embeddedMarkdown: {id: 'embeddedMarkdown', markdown: '# Embedded'},
      },
    },
    blockDocuments: {
      artifacts: {
        legacyBlockDocument: {
          id: 'legacyBlockDocument',
          content: {
            type: 'doc',
            content: [
              {
                type: 'blockDocumentStatefulBlock',
                attrs: {
                  id: 'embeddedMarkdown',
                  blockType: 'document',
                  blockInstanceId: 'embeddedMarkdown',
                },
              },
            ],
          },
        },
        currentDocument: {
          id: 'currentDocument',
          content: {type: 'doc', content: []},
        },
      },
    },
  };
}

describe('migrateCliPersistedWorkspace', () => {
  it('uses backing state to migrate artifact and embedded block types', () => {
    const migrated = migrateCliPersistedWorkspace(persistedWorkspace());
    const artifacts = (
      migrated.artifacts as {
        artifactsById: Record<string, {type: string}>;
      }
    ).artifactsById;

    expect(artifacts.legacyBlockDocument.type).toBe('document');
    expect(artifacts.legacyMarkdown.type).toBe('markdown');
    expect(artifacts.currentDocument.type).toBe('document');
    expect(artifacts.currentMarkdown.type).toBe('markdown');
    expect(artifacts.orphanedLegacyMarkdown.type).toBe('markdown');
    expect(artifacts.dashboard.type).toBe('dashboard');

    const blockDocuments = migrated.blockDocuments as {
      artifacts: Record<
        string,
        {content: {content: Array<{attrs: {blockType: string}}>}}
      >;
    };
    expect(
      blockDocuments.artifacts.legacyBlockDocument.content.content[0]?.attrs
        .blockType,
    ).toBe('markdown');
  });

  it('is idempotent', () => {
    const migrated = migrateCliPersistedWorkspace(persistedWorkspace());
    expect(migrateCliPersistedWorkspace(migrated)).toEqual(migrated);
  });

  it('rejects artifacts with both backing states', () => {
    const persisted = persistedWorkspace();
    persisted.documents.artifacts.currentDocument = {
      id: 'currentDocument',
      markdown: '# Invalid duplicate backing state',
    };

    expect(() => migrateCliPersistedWorkspace(persisted)).toThrow(
      'cannot have both Markdown and block-document backing state',
    );
  });

  it('rejects duplicate backing state without artifact metadata', () => {
    const persisted = persistedWorkspace();
    persisted.documents.artifacts.unregisteredDuplicate = {
      id: 'unregisteredDuplicate',
      markdown: '# Duplicate',
    };
    persisted.blockDocuments.artifacts.unregisteredDuplicate = {
      id: 'unregisteredDuplicate',
      content: {type: 'doc', content: []},
    };

    expect(() => migrateCliPersistedWorkspace(persisted)).toThrow(
      'cannot have both Markdown and block-document backing state',
    );
  });
});
