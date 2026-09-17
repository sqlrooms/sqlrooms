import {MarkdownDocumentsSliceConfig} from '@sqlrooms/documents';
import {ArtifactsSliceConfig} from '@sqlrooms/artifacts';
import {ArtifactAiConfigSchema} from '@sqlrooms/artifacts/ai';
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
  it('restores legacy session associations and pinned artifacts alongside documents', () => {
    const persisted = {
      ...persistedWorkspace(),
      artifactAi: {
        sessionArtifactLinks: [
          {
            sessionId: 'chat',
            artifactId: 'legacyBlockDocument',
            createdAt: 1786377310614,
            linkType: 'attached',
          },
        ],
        pinnedArtifactIds: ['legacyBlockDocument'],
      },
    };
    const migrated = migrateCliPersistedWorkspace(persisted);
    expect(ArtifactAiConfigSchema.parse(migrated.artifactAi)).toEqual({
      sessionArtifactLinks: [
        {
          sessionId: 'chat',
          artifactId: 'legacyBlockDocument',
          linkedAt: 1786377310614,
        },
      ],
    });
    expect(ArtifactsSliceConfig.parse(migrated.artifacts)).toMatchObject({
      pinnedArtifactIds: ['legacyBlockDocument'],
      artifactsById: {legacyBlockDocument: {type: 'block-document'}},
    });
    expect(migrateCliPersistedWorkspace(migrated)).toEqual(migrated);
    expect(persisted.artifactAi.sessionArtifactLinks[0]).toHaveProperty(
      'createdAt',
      1786377310614,
    );
  });

  it('preserves canonical association timestamps and pins, including empty pins', () => {
    const migrated = migrateCliPersistedWorkspace({
      artifacts: {pinnedArtifactIds: []},
      artifactAi: {
        pinnedArtifactIds: ['old-pin'],
        sessionArtifactLinks: [
          {
            sessionId: 'chat',
            artifactId: 'doc',
            linkedAt: 2,
            createdAt: 1,
            linkType: 'created',
          },
        ],
      },
    });
    expect(ArtifactAiConfigSchema.parse(migrated.artifactAi)).toEqual({
      sessionArtifactLinks: [
        {sessionId: 'chat', artifactId: 'doc', linkedAt: 2},
      ],
    });
    expect(
      ArtifactsSliceConfig.parse(migrated.artifacts).pinnedArtifactIds,
    ).toEqual([]);
  });

  it('keeps invalid legacy associations subject to schema validation', () => {
    const migrated = migrateCliPersistedWorkspace({
      artifactAi: {
        sessionArtifactLinks: [
          {sessionId: 'chat', artifactId: 'doc', linkType: 'attached'},
        ],
      },
    });
    expect(() => ArtifactAiConfigSchema.parse(migrated.artifactAi)).toThrow();
  });

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

  it('preserves legacy Markdown bodies and assets through canonical schema parsing', () => {
    const document = {
      id: 'notes',
      markdown: '![Chart](asset://chart)',
      assets: {
        chart: {
          id: 'chart',
          mediaType: 'image/png',
          encoding: 'base64',
          data: 'aW1hZ2U=',
          createdAt: 1,
          updatedAt: 2,
        },
      },
      updatedAt: 3,
    };
    const migrated = migrateCliPersistedWorkspace({
      documents: {artifacts: {notes: document}},
      artifacts: {
        artifactsById: {notes: {id: 'notes', type: 'markdown', title: 'Notes'}},
      },
    });

    expect(
      MarkdownDocumentsSliceConfig.parse(migrated.markdownDocuments),
    ).toEqual({
      artifacts: {notes: document},
    });
    expect(migrated.artifacts).toMatchObject({
      artifactsById: {notes: {type: 'markdown-document'}},
    });
    expect(migrated).not.toHaveProperty('documents');
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
