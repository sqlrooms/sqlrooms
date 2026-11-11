/** @jest-environment jsdom */
import {beforeEach, expect, it, jest} from '@jest/globals';
import {act, useState} from 'react';
import {createRoot} from 'react-dom/client';

// Real Radix dialogs exercise focus and layout effects while CI runs many suites.
jest.setTimeout(30_000);

const commit = jest.fn(async (_source: unknown, _name: string) => {});
const prepare = jest.fn(async (_source: unknown, _signal?: AbortSignal) => ({
  path: '/tmp/sales.csv',
  query: 'SELECT 1',
}));
const preview = jest.fn(async () => ({numRows: 100}));
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
});
jest.unstable_mockModule('../store', () => ({useRoomStore: () => []}));
jest.unstable_mockModule('../dataImport', () => ({
  inferDataFileFormat: () => 'csv',
  suggestImportTableName: () => 'sales',
  prepareDataImport: prepare,
  previewDataImport: preview,
  commitDataImport: commit,
}));
jest.unstable_mockModule('@sqlrooms/data-table', () => ({
  // Pagination controls intentionally use the browser's default button type,
  // as the shared data-table footer currently does.
  DataTableArrowPaginated: () => {
    const [page, setPage] = useState(1);
    return (
      <button onClick={() => setPage(page + 1)}>Preview page {page}</button>
    );
  },
}));
const {AddDataDialog} = await import('../AddDataDialog');
it('previews a chosen file, keeps pagination separate from confirmation, then imports', async () => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const close = jest.fn();
  try {
    await act(async () => root.render(<AddDataDialog onClose={close} />));
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x\n1'], 'sales.csv')],
    });
    await act(async () =>
      input.dispatchEvent(new Event('change', {bubbles: true})),
    );
    expect(
      document.querySelector<HTMLInputElement>('#data-table-name')?.value,
    ).toBe('sales');
    expect(commit).not.toHaveBeenCalled();
    const pagination = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Preview page 1',
    )!;
    await act(async () => pagination.click());
    expect(pagination.textContent).toBe('Preview page 2');
    expect(commit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    const confirm = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Add data',
    )!;
    await act(async () => confirm.click());
    expect(commit).toHaveBeenCalledWith(
      {path: '/tmp/sales.csv', query: 'SELECT 1'},
      'sales',
    );
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

/** Activate a Radix tab through its mouse handler and verify selection. */
async function selectTab(name: string) {
  const tab = Array.from(
    document.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).find((element) => element.textContent === name)!;
  await act(async () =>
    tab.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0})),
  );
  expect(tab.getAttribute('aria-selected')).toBe('true');
}

/** Dispatch a native input edit so React updates the controlled field. */
async function fill(id: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

it('keeps each tab’s source and name, clears previews, and previews the restored source', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AddDataDialog onClose={jest.fn()} />));
    const input = document.querySelector<HTMLInputElement>('#data-file')!;
    const file = new File(['x\n1'], 'sales.csv');
    Object.defineProperty(input, 'files', {value: [file]});
    await act(async () =>
      input.dispatchEvent(new Event('change', {bubbles: true})),
    );
    await fill('data-table-name', 'file_sales');
    expect(
      document.querySelector('[aria-label="Data preview"]'),
    ).not.toBeNull();

    await selectTab('Web URL');
    expect(document.querySelector('[aria-label="Data preview"]')).toBeNull();
    await fill('data-url', 'https://example.com/download');
    await fill('data-table-name', 'web_sales');
    const format = document.querySelector<HTMLSelectElement>('#data-format')!;
    await act(async () => {
      format.value = 'parquet';
      format.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await selectTab('File path');
    await fill('data-path', '/tmp/local.csv');
    await fill('data-table-name', 'local_sales');

    await selectTab('File');
    expect(document.body.textContent).toContain('Selected: sales.csv');
    expect(
      document.querySelector<HTMLInputElement>('#data-table-name')?.value,
    ).toBe('file_sales');
    expect(document.querySelector('[aria-label="Data preview"]')).toBeNull();
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click(),
    );
    expect(prepare).toHaveBeenLastCalledWith(
      {kind: 'file', file},
      expect.any(AbortSignal),
    );

    await selectTab('File path');
    expect(document.querySelector<HTMLInputElement>('#data-path')?.value).toBe(
      '/tmp/local.csv',
    );
    expect(
      document.querySelector<HTMLInputElement>('#data-table-name')?.value,
    ).toBe('local_sales');
    await selectTab('Web URL');
    expect(document.querySelector<HTMLInputElement>('#data-url')?.value).toBe(
      'https://example.com/download',
    );
    expect(
      document.querySelector<HTMLInputElement>('#data-table-name')?.value,
    ).toBe('web_sales');
    expect(
      document.querySelector<HTMLSelectElement>('#data-format')?.value,
    ).toBe('parquet');
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click(),
    );
    expect(prepare).toHaveBeenLastCalledWith(
      {kind: 'url', url: 'https://example.com/download', format: 'parquet'},
      expect.any(AbortSignal),
    );
    expect(commit).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('aborts a pending preview on tab changes and ignores its late result', async () => {
  let finish!: (value: {numRows: number}) => void;
  preview.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AddDataDialog onClose={jest.fn()} />));
    const input = document.querySelector<HTMLInputElement>('#data-file')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['x\n1'], 'sales.csv')],
    });
    await act(async () =>
      input.dispatchEvent(new Event('change', {bubbles: true})),
    );
    const signal = prepare.mock.calls[0]![1]!;
    expect(signal.aborted).toBe(false);
    await selectTab('Web URL');
    expect(signal.aborted).toBe(true);
    await act(async () => finish({numRows: 100}));
    expect(document.querySelector('[aria-label="Data preview"]')).toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toBe('');
    expect(commit).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
