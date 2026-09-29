import {describe, expect, it, jest} from '@jest/globals';
import {uploadBrowserFile, type UploadFetcher} from '../upload';

describe('browser file upload', () => {
  it('uploads the bytes before importing the returned server path', async () => {
    const fetcher = jest.fn<UploadFetcher>(async (_input, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      return {
        ok: true,
        statusText: 'OK',
        json: async () => ({path: '/tmp/roomie_uploads/cars.csv'}),
      } as Response;
    });
    const connector = {
      loadFile: jest.fn(async (_file: string | File, _tableName: string) => {}),
    };
    await uploadBrowserFile(
      new File(['city,value\nZürich,1\n'], 'cars.csv', {type: 'text/csv'}),
      'cars',
      connector,
      fetcher,
    );
    expect(connector.loadFile).toHaveBeenCalledWith(
      '/tmp/roomie_uploads/cars.csv',
      'cars',
    );
  });

  it('rejects an unsafe server path before importing it', async () => {
    const connector = {
      loadFile: jest.fn(async (_file: string | File, _tableName: string) => {}),
    };
    await expect(
      uploadBrowserFile(
        new File(['value\n1\n'], 'values.csv'),
        'values',
        connector,
        async () =>
          ({
            ok: true,
            json: async () => ({path: '../private.csv'}),
          }) as Response,
      ),
    ).rejects.toThrow('invalid server path');
    expect(connector.loadFile).not.toHaveBeenCalled();
  });
});
