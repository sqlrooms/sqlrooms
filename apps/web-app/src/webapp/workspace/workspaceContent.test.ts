import {describe, expect, test, vi} from 'vitest';
import type {JsonObject} from '#/lib/json';

vi.mock('../document/defaultBlockDocument', () => ({
  createDefaultDocumentContent: () => ({type: 'doc', content: []}),
}));
vi.mock('../document/documentState', () => ({
  createEmptyPersistedSqlEditorConfig: () => ({
    queries: [],
    selectedQueryId: '',
    openTabs: [],
  }),
  ensureStatefulBlocksForContent: vi.fn(),
}));
import {
  createDefaultWorkspaceContent,
  parseWorkspaceContent,
} from './workspaceContent';

describe('workspace content', () => {
  test('persists an explicit session-document relationship graph', () => {
    expect(createDefaultWorkspaceContent().artifactAi).toEqual({
      sessionArtifactLinks: [],
    });
  });

  test('accepts many-to-many session-document links', () => {
    const content = createDefaultWorkspaceContent();
    content.artifactAi.sessionArtifactLinks = [
      {sessionId: 'chat-1', artifactId: 'document-1', linkedAt: 1},
      {sessionId: 'chat-1', artifactId: 'document-2', linkedAt: 2},
      {sessionId: 'chat-2', artifactId: 'document-2', linkedAt: 3},
    ];

    expect(
      parseWorkspaceContent(content as unknown as JsonObject)?.artifactAi
        .sessionArtifactLinks,
    ).toEqual(content.artifactAi.sessionArtifactLinks);
  });

  test('rejects unsupported artifact types instead of migrating them', () => {
    const content = createDefaultWorkspaceContent();
    const documentId = content.artifacts.artifactOrder[0]!;
    content.artifacts.artifactsById[documentId] = {
      id: documentId,
      type: 'legacy-artifact',
      title: 'Legacy artifact',
    };

    expect(parseWorkspaceContent(content as unknown as JsonObject)).toBeNull();
  });
});
