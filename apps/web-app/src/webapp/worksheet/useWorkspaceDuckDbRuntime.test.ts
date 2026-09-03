import {describe, expect, test} from 'vitest';
import {
  areTableNamesEqual,
  isWorkspaceRuntimeCurrent,
} from './useWorkspaceDuckDbRuntime';
import type {WorkspaceDuckDbRuntime} from './duckdbRuntime';

describe('areTableNamesEqual', () => {
  test('recognizes an unchanged ordered table list', () => {
    expect(areTableNamesEqual(['events', 'users'], ['events', 'users'])).toBe(
      true,
    );
    expect(areTableNamesEqual(['events'], ['users'])).toBe(false);
  });

  test('hides the previous runtime during a workspace switch', () => {
    const runtime = {workspaceKey: 'workspace_first'} as WorkspaceDuckDbRuntime;
    expect(isWorkspaceRuntimeCurrent(runtime, 'workspace_second')).toBe(false);
  });
});
