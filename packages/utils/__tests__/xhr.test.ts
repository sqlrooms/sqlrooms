import {
  downloadFile,
  downloadFileWithMetadata,
  isDownloadFileError,
} from '../src/xhr';

type FakeResponse =
  | {status: number; body?: Uint8Array; contentType?: string}
  | 'network-error';

/** Minimal XMLHttpRequest stand-in that answers with `next`. */
let next: FakeResponse;
class FakeXhr {
  status = 0;
  response: ArrayBuffer | null = null;
  responseType = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onprogress: (() => void) | null = null;
  private contentType: string | undefined;
  open() {}
  setRequestHeader() {}
  getResponseHeader(name: string) {
    return name.toLowerCase() === 'content-type'
      ? (this.contentType ?? null)
      : null;
  }
  send() {
    const res = next;
    queueMicrotask(() => {
      if (res === 'network-error') {
        this.onerror?.();
        return;
      }
      this.status = res.status;
      this.contentType = res.contentType;
      const body = res.body ?? new Uint8Array();
      this.response = body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer;
      this.onload?.();
    });
  }
}

beforeAll(() => {
  (globalThis as any).XMLHttpRequest = FakeXhr;
});
afterAll(() => {
  delete (globalThis as any).XMLHttpRequest;
});

describe('downloadFileWithMetadata', () => {
  it('returns the body, status and content type', async () => {
    next = {
      status: 200,
      body: new Uint8Array([1, 2, 3]),
      contentType: 'text/csv; charset=utf-8',
    };
    const result = await downloadFileWithMetadata('https://example.com/x');
    expect(Array.from(result.data)).toEqual([1, 2, 3]);
    expect(result.status).toBe(200);
    expect(result.contentType).toBe('text/csv; charset=utf-8');
  });

  it('rejects with the HTTP status and content type', async () => {
    next = {status: 404, contentType: 'application/xml'};
    const error = await downloadFileWithMetadata('https://example.com/x').catch(
      (e: unknown) => e,
    );
    expect(isDownloadFileError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 404,
      error: 'File download failed',
      contentType: 'application/xml',
    });
    expect((error as Error).message).toContain('404');
  });

  it('rejects with status 0 on network or CORS errors', async () => {
    next = 'network-error';
    const error = await downloadFileWithMetadata('https://example.com/x').catch(
      (e: unknown) => e,
    );
    expect(isDownloadFileError(error)).toBe(true);
    expect(error).toMatchObject({status: 0});
  });
});

describe('downloadFile', () => {
  it('still resolves with a Uint8Array', async () => {
    next = {status: 200, body: new Uint8Array([7])};
    const data = await downloadFile('https://example.com/x');
    expect(data).toBeInstanceOf(Uint8Array);
    expect(Array.from(data)).toEqual([7]);
  });

  it('still rejects with {status, error}', async () => {
    next = {status: 500};
    await expect(downloadFile('https://example.com/x')).rejects.toMatchObject({
      status: 500,
      error: 'File download failed',
    });
  });
});

describe('isDownloadFileError', () => {
  it('rejects unrelated errors', () => {
    expect(isDownloadFileError(new Error('x'))).toBe(false);
    expect(
      isDownloadFileError({status: 0, error: 'File download failed'}),
    ).toBe(false);
  });
});
