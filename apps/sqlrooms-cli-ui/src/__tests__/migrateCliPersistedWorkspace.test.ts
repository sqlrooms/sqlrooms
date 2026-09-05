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

    expect(artifacts.legacyBlockDocument.type).toBe('block-document');
    expect(artifacts.legacyMarkdown.type).toBe('markdown-document');
    expect(artifacts.currentDocument.type).toBe('block-document');
    expect(artifacts.currentMarkdown.type).toBe('markdown-document');
    expect(artifacts.orphanedLegacyMarkdown.type).toBe('markdown-document');
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
    ).toBe('markdown-document');
  });

  it('preserves canonical block documents and their content', () => {
    const persisted = persistedWorkspace();
    persisted.artifacts.artifactsById.currentDocument.type = 'block-document';
    const migrated = migrateCliPersistedWorkspace(persisted);

    expect(migrated.artifacts).toMatchObject({
      artifactsById: {
        currentDocument: persisted.artifacts.artifactsById.currentDocument,
      },
    });
    expect(migrated.blockDocuments).toMatchObject({
      artifacts: {
        currentDocument: persisted.blockDocuments.artifacts.currentDocument,
      },
    });
  });

  it('merges old and canonical slice entries with canonical values taking precedence', () => {
    const persisted = persistedWorkspace();
    const canonical = {id: 'currentMarkdown', markdown: '# Canonical'};
    const migrated = migrateCliPersistedWorkspace({
      ...persisted,
      markdownDocuments: {
        artifacts: {
          currentMarkdown: canonical,
          canonicalOnly: {id: 'canonicalOnly', markdown: '# New'},
        },
      },
    });
    expect(migrated).not.toHaveProperty('documents');
    expect(migrated.markdownDocuments).toEqual({
      artifacts: {
        ...persisted.documents.artifacts,
        currentMarkdown: canonical,
        canonicalOnly: {id: 'canonicalOnly', markdown: '# New'},
      },
    });
  });

  it('migrates Markdown slices and embedded blocks without artifact metadata', () => {
    const persisted = persistedWorkspace();
    const block = persisted.blockDocuments.artifacts.legacyBlockDocument
      .content as {
      content: Array<{attrs: {blockType: string}}>;
    };
    block.content[0]!.attrs.blockType = 'markdown';
    const migrated = migrateCliPersistedWorkspace({
      documents: persisted.documents,
      blockDocuments: persisted.blockDocuments,
    });
    expect(migrated).not.toHaveProperty('documents');
    expect(migrated.markdownDocuments).toEqual(persisted.documents);
    expect(migrated.blockDocuments).toMatchObject({
      artifacts: {
        legacyBlockDocument: {
          content: {content: [{attrs: {blockType: 'markdown-document'}}]},
        },
      },
    });
    expect(block.content[0]!.attrs.blockType).toBe('markdown');
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
