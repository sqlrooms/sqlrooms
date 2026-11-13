/** @jest-environment jsdom */
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';

const tables: {table: {table: string}}[] = [];
const prepare = jest.fn(async (source: {kind: 'file'; file: File}) => ({
  path: source.file.name,
  query: 'SELECT 1',
}));
const commit = jest.fn(async (_source: unknown, name: string) => {
  tables.push({table: {table: name}});
});
jest.unstable_mockModule('../store', () => ({
  roomStore: {
    getState: () => ({db: {tables}, commands: {invokeCommand: jest.fn()}}),
  },
  connector: {},
}));
// Keep source validation and name generation real while replacing network/DB I/O.
const dataImport = await import('../dataImport');
jest.unstable_mockModule('../dataImport', () => ({
  ...dataImport,
  prepareDataImport: prepare,
  commitDataImport: commit,
}));
const {QuickAddData} = await import('../QuickAddData');
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  jest.clearAllMocks();
  tables.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<QuickAddData />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
/** Dispatch a browser-style file drop to the sidebar import target. */
async function drop(files: File[]) {
  const event = new Event('drop', {bubbles: true, cancelable: true});
  Object.defineProperty(event, 'dataTransfer', {value: {files}});
  await act(async () => {
    host.firstElementChild!.dispatchEvent(event);
  });
}
describe('quick sidebar imports', () => {
  it('imports multiple dropped files immediately with unused names', async () => {
    tables.push({table: {table: 'sales'}});
    await drop([new File(['x'], 'sales.csv'), new File(['y'], 'sales.csv')]);
    expect(commit.mock.calls.map((call) => call[1])).toEqual([
      'sales_1',
      'sales_2',
    ]);
    expect(host.textContent).toContain('Added 2 files.');
  });
  it('continues after a failed file and reports both successes and failures', async () => {
    commit.mockRejectedValueOnce(new Error('Unreadable file'));
    await drop([new File(['x'], 'bad.csv'), new File(['y'], 'good.csv')]);
    expect(host.textContent).toContain('Added 1 file.');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'bad.csv: Unreadable file',
    );
  });
  it('rejects unsupported files before uploading', async () => {
    await drop([new File(['x'], 'bad.exe')]);
    expect(prepare).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Use CSV',
    );
  });
});
