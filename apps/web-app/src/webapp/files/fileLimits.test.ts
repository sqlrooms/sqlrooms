import {describe, expect, it} from 'vitest';
import {createR2ObjectKey} from './fileLimits';

describe('createR2ObjectKey', () => {
  it('organizes parquet objects by sanitized user and workspace ids', () => {
    expect(
      createR2ObjectKey({
        userId: 'user/one@example.com',
        workspaceId: 'workspace:123',
        fileId: 'file.456',
      }),
    ).toBe('users/useroneexamplecom/workspaces/workspace123/file456.parquet');
  });

  it('limits path segment length', () => {
    const longId = 'a'.repeat(200);
    const key = createR2ObjectKey({
      userId: longId,
      workspaceId: longId,
      fileId: longId,
    });

    const [userSegment, workspaceSegment, fileSegment] = key
      .replace(/^users\//, '')
      .replace('/workspaces/', '/')
      .replace(/\.parquet$/, '')
      .split('/');

    expect(userSegment).toHaveLength(120);
    expect(workspaceSegment).toHaveLength(120);
    expect(fileSegment).toHaveLength(120);
  });
});
