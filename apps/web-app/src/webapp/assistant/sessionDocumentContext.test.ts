import {describe, expect, test} from 'vitest';
import {createSessionDocumentRunContext} from './sessionDocumentContext';

describe('createSessionDocumentRunContext', () => {
  test('includes every linked document and makes the selected document primary', () => {
    expect(
      createSessionDocumentRunContext({
        sessionId: 'chat-1',
        primaryDocumentId: 'document-1',
        sessionArtifactLinks: [
          {sessionId: 'chat-1', artifactId: 'document-1', linkedAt: 1},
          {sessionId: 'chat-1', artifactId: 'document-2', linkedAt: 2},
          {sessionId: 'chat-2', artifactId: 'document-2', linkedAt: 3},
        ],
        artifactsById: {
          'document-1': {
            id: 'document-1',
            type: 'document',
            title: 'Revenue',
          },
          'document-2': {
            id: 'document-2',
            type: 'document',
            title: 'Retention',
          },
        },
        capturedAt: 10,
      }),
    ).toEqual({
      items: [
        {
          kind: 'document',
          id: 'document-1',
          title: 'Revenue',
          type: 'document',
        },
        {
          kind: 'document',
          id: 'document-2',
          title: 'Retention',
          type: 'document',
        },
      ],
      primaryItemId: 'document-1',
      primaryItemKind: 'document',
      capturedAt: 10,
    });
  });
});
