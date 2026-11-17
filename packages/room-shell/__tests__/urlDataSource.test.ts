import {afterAll, beforeAll, describe, expect, jest, test} from '@jest/globals';
import type {DuckDbConnector} from '@sqlrooms/duckdb';
import {createStore} from 'zustand';
import {
  createRoomShellSlice,
  type RoomShellSliceState,
} from '../src/RoomShellSlice';

type FakeResponse = {status: number; body?: string; contentType?: string};

/** Minimal XMLHttpRequest stand-in: answers with `nextResponse`, records URLs. */
let nextResponse: FakeResponse;
const requestedUrls: string[] = [];
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
  open(_method: string, url: string) {
    requestedUrls.push(url);
  }
  setRequestHeader() {}
  getResponseHeader() {
    return this.contentType ?? null;
  }
  send() {
    const res = nextResponse;
    queueMicrotask(() => {
      if (res.status === 0) {
        this.onerror?.();
        return;
      }
      this.status = res.status;
      this.contentType = res.contentType;
      this.response = new TextEncoder().encode(res.body ?? '')
        .buffer as ArrayBuffer;
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

function createTestStore() {
  const loadFile = jest.fn(async () => {});
  const connector = {loadFile} as unknown as DuckDbConnector;
  const store = createStore<RoomShellSliceState>()((set, get, api) =>
    createRoomShellSlice({connector})(set as any, get as any, api as any),
  );
  // Stub the DuckDB-backed helpers that run after a load.
  store.setState((state) => ({
    db: {
      ...state.db,
      getTableRowCount: async () => 1,
      refreshTableSchemas: async () => [],
    },
  }));
  return {store, loadFile};
}

describe('URL data sources', () => {
  test('downloads s3:// URLs over https and keeps the original URL', async () => {
    const {store, loadFile} = createTestStore();
    nextResponse = {status: 200, body: 'a,b\n1,2\n', contentType: 'text/csv'};
    const url = 's3://my-bucket/export';

    await store
      .getState()
      .room.addDataSource({type: 'url', url, tableName: 't'});

    expect(requestedUrls.at(-1)).toBe(
      'https://my-bucket.s3.amazonaws.com/export',
    );
    expect(loadFile).toHaveBeenCalledTimes(1);
    const [file, tableName, loadOptions] = loadFile.mock
      .calls[0] as unknown as [File, string, unknown];
    expect(file.name).toBe(url);
    expect(file.type).toBe('text/csv');
    expect(tableName).toBe('t');
    expect(loadOptions).toBeUndefined();
    const {roomFilesProgress, roomFiles, config} = store.getState().room;
    expect(roomFilesProgress[url]).toEqual({status: 'done'});
    expect(roomFiles.map((f) => f.pathname)).toEqual([url]);
    expect(config.dataSources).toEqual([{type: 'url', url, tableName: 't'}]);
  });

  test.each([
    [
      0,
      'The server did not allow this site to read the file (CORS), or it is unreachable.',
    ],
    [
      403,
      'Access denied (HTTP 403). The file may be private or require credentials.',
    ],
    [404, 'File not found (HTTP 404).'],
    [500, 'Download failed (HTTP 500).'],
  ])('reports HTTP status %i as a readable error', async (status, message) => {
    const {store, loadFile} = createTestStore();
    nextResponse = {status};
    const url = `https://example.com/data-${status}.csv`;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await store
      .getState()
      .room.addDataSource({type: 'url', url, tableName: 't'});

    expect(loadFile).not.toHaveBeenCalled();
    const {roomFilesProgress, dataSourceStates} = store.getState().room;
    expect(roomFilesProgress[url]).toEqual({status: 'error', message});
    expect(dataSourceStates.t).toEqual({status: 'ERROR', message});
  });

  test('reports load errors separately from download errors', async () => {
    const {store, loadFile} = createTestStore();
    loadFile.mockRejectedValueOnce(new Error('Catalog Error: bad file'));
    nextResponse = {status: 200, body: 'x'};
    const url = 'https://example.com/data.csv';
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await store
      .getState()
      .room.addDataSource({type: 'url', url, tableName: 't'});

    expect(store.getState().room.roomFilesProgress[url]).toEqual({
      status: 'error',
      message: 'Could not load the file: Catalog Error: bad file',
    });
  });
});
