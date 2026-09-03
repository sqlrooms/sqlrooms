import {describe, expect, test} from 'vitest';
import {
  createAssistantInstructions,
  parseWorkspaceAiConfig,
} from './workspaceAi';

describe('parseWorkspaceAiConfig', () => {
  test('falls back when persisted configuration is malformed', () => {
    expect(parseWorkspaceAiConfig({sessions: {}})).toMatchObject({
      sessions: [],
      openSessionTabs: [],
    });
  });
});

describe('createAssistantInstructions', () => {
  test('uses the primary document when multiple documents are present', () => {
    const instructions = createAssistantInstructions({
      primaryItemId: 'document-b',
      primaryItemKind: 'document',
      items: [
        {kind: 'document', id: 'document-a', title: 'Document A'},
        {kind: 'document', id: 'document-b', title: 'Document B'},
      ],
    });

    expect(instructions).toContain('Primary document: Document B');
  });

  test('retains the title from a legacy document context', () => {
    const instructions = createAssistantInstructions({
      primaryItemId: 'legacy-document',
      primaryItemKind: 'worksheet',
      items: [
        {
          kind: 'worksheet',
          id: 'legacy-document',
          title: 'Legacy analysis',
        },
      ],
    });

    expect(instructions).toContain('Primary document: Legacy analysis');
  });
});
