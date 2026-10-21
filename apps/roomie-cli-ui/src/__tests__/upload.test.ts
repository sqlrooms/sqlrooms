import {describe, expect, it, jest} from '@jest/globals';
import {stageBrowserFile, type UploadFetcher} from '../upload';

describe('browser file staging', () => {
  it('uploads the bytes and returns a path without importing a table', async () => {
    const file = new File(['city,value\nZürich,1\n'], 'cars.csv', {
      type: 'text/csv',
    });
    const controller = new AbortController();
    const fetcher = jest.fn<UploadFetcher>(async (_input, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      const uploaded = (init?.body as FormData).get('file') as File;
      expect(uploaded.name).toBe(file.name);
      expect(await uploaded.text()).toBe(await file.text());
      expect(init?.signal).toBe(controller.signal);
      return new Response(JSON.stringify({path: '/tmp/uploads/cars.csv'}));
    });
    expect(await stageBrowserFile(file, fetcher, controller.signal)).toBe(
      '/tmp/uploads/cars.csv',
    );
  });
  it.each(['../private.csv', '', null])(
    'rejects an invalid server path %s',
    async (path) => {
      await expect(
        stageBrowserFile(
          new File(['a'], 'data.csv'),
          async () => new Response(JSON.stringify({path})),
        ),
      ).rejects.toThrow('invalid server path');
    },
  );
  it('reports upload errors', async () => {
    await expect(
      stageBrowserFile(
        new File(['a'], 'data.csv'),
        async () =>
          new Response('{}', {status: 500, statusText: 'Request failed'}),
      ),
    ).rejects.toThrow('Upload failed');
  });
  it('accepts spaces and Unicode in server paths', async () => {
    const path = '/tmp/Roomie Zürich/uploads/values.csv';
    expect(
      await stageBrowserFile(
        new File(['a'], 'data.csv'),
        async () => new Response(JSON.stringify({path})),
      ),
    ).toBe(path);
  });
});
