import {afterAll, beforeAll, describe, expect, jest, test} from '@jest/globals';
import type {DuckDbConnector} from '@sqlrooms/duckdb';
import {createStore} from 'zustand';
import {
  createRoomShellSlice,
  type RoomShellSliceState,
} from '../src/RoomShellSlice';
import {DataSourceStatus} from '../src/types';

type FakeResponse = {
  status: number;
  body?: string;
  contentType?: string;
  /** Delay the response until this promise resolves. */
  until?: Promise<void>;
};

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
    void (res.until ?? Promise.resolve()).then(() => {
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
  test('passes the response Content-Type to the connector as File.type', async () => {
    const {store, loadFile} = createTestStore();
    nextResponse = {status: 200, body: 'a,b\n1,2\n', contentType: 'text/csv'};
    const url = 'https://api.example.com/export?format=csv';

    await store
      .getState()
      .room.addDataSource({type: 'url', url, tableName: 't'});

    expect(requestedUrls.at(-1)).toBe(url);
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

  test('does not mark a replacement source as failed', async () => {
    const {store} = createTestStore();
    let respond!: () => void;
    nextResponse = {status: 404, until: new Promise((r) => (respond = r))};
    const oldUrl = 'https://example.com/old.csv';
    const newUrl = 'https://example.com/new.csv';
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const oldLoad = store
      .getState()
      .room.addDataSource({type: 'url', url: oldUrl, tableName: 't'});
    // Replace the table's source while the old download is in flight.
    await store
      .getState()
      .room.addDataSource(
        {type: 'url', url: newUrl, tableName: 't'},
        DataSourceStatus.READY,
      );
    respond();
    await oldLoad;

    const {roomFilesProgress, dataSourceStates} = store.getState().room;
    expect(roomFilesProgress[oldUrl]).toMatchObject({status: 'error'});
    expect(dataSourceStates.t).toEqual({status: DataSourceStatus.READY});
  });
});
