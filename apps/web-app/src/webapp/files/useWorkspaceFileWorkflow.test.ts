import {describe, expect, test, vi} from 'vitest';
import {uploadPreparedFilesSequentially} from './useWorkspaceFileWorkflow';

describe('uploadPreparedFilesSequentially', () => {
  test('keeps the failed and later files available for retry', async () => {
    const files = [{id: 'first'}, {id: 'second'}, {id: 'third'}];
    const uploaded: string[] = [];
    const upload = vi.fn(async (file: {id: string}) => {
      if (file.id === 'second') throw new Error('upload failed');
    });

    await expect(
      uploadPreparedFilesSequentially(files, upload, (file) =>
        uploaded.push(file.id),
      ),
    ).rejects.toThrow('upload failed');

    expect(uploaded).toEqual(['first']);
    expect(upload).toHaveBeenCalledTimes(2);
  });
});
