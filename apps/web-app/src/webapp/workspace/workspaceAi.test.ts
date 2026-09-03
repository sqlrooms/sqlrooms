import {describe, expect, test} from 'vitest';
import {parseWorkspaceAiConfig} from './workspaceAi';

describe('parseWorkspaceAiConfig', () => {
  test('falls back when persisted configuration is malformed', () => {
    expect(parseWorkspaceAiConfig({sessions: {}})).toMatchObject({
      sessions: [],
      openSessionTabs: [],
    });
  });
});
