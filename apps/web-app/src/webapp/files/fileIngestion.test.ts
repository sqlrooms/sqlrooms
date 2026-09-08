import {describe, expect, it, vi} from 'vitest';
import {
  createTableName,
  prepareReplacementWorkspaceFile,
  prepareWorkspaceFile,
} from './fileIngestion';
import {SOURCE_FILE_LIMIT_BYTES} from './fileLimits';
import type {WorkspaceDuckDbRuntime} from '../document/duckdbRuntime';

describe('createTableName', () => {
  it('sanitizes source file names without adding a random suffix', () => {
    expect(createTableName('Revenue by Region (Q1).csv')).toBe(
      'Revenue_by_Region_Q1',
    );
  });

  it('falls back when a file name has no usable table characters', () => {
    expect(createTableName('!!!.csv')).toBe('uploaded_file');
  });

  it('prefixes names that would otherwise start with a number', () => {
    expect(createTableName('2026 sales.csv')).toBe('_2026_sales');
  });

  it('rejects oversized source files before loading them into DuckDB', async () => {
    const loadFile = vi.fn();
    const runtime = {
      connector: {loadFile},
    } as unknown as WorkspaceDuckDbRuntime;
    const file = {
      name: 'large.csv',
      size: SOURCE_FILE_LIMIT_BYTES + 1,
    } as File;

    await expect(prepareWorkspaceFile({runtime, file})).rejects.toThrow(
      'Source file is too large',
    );
    expect(loadFile).not.toHaveBeenCalled();
  });

  it('keeps the existing table when replacement preparation fails', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      connector: {
        execute,
        loadFile: vi.fn().mockRejectedValue(new Error('unreadable file')),
      },
    } as unknown as WorkspaceDuckDbRuntime;

    await expect(
      prepareReplacementWorkspaceFile({
        runtime,
        file: {name: 'orders.csv', size: 10} as File,
        tableName: 'Orders',
      }),
    ).rejects.toThrow('unreadable file');

    expect(
      execute.mock.calls.some(([query]) =>
        String(query).includes('drop table if exists "Orders"'),
      ),
    ).toBe(false);
  });

  it('swaps a prepared replacement only after its Parquet export succeeds', async () => {
    const queries: string[] = [];
    const dropFile = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      connector: {
        type: 'wasm',
        execute: vi.fn(async (query: string) => {
          queries.push(query);
        }),
        loadFile: vi.fn().mockResolvedValue(undefined),
        queryJson: vi.fn().mockResolvedValue([{row_count: 2}]),
        getDb: () => ({
          copyFileToBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2])),
          dropFile,
        }),
      },
    } as unknown as WorkspaceDuckDbRuntime;

    const preparedFile = await prepareReplacementWorkspaceFile({
      runtime,
      file: {name: 'orders.csv', size: 10} as File,
      tableName: 'Orders',
    });

    const copyIndex = queries.findIndex((query) => query.startsWith('copy '));
    const dropIndex = queries.indexOf('drop table if exists "Orders"');
    expect(preparedFile.tableName).toBe('Orders');
    expect(copyIndex).toBeGreaterThanOrEqual(0);
    expect(dropIndex).toBeGreaterThan(copyIndex);
    expect(queries.slice(dropIndex - 1)).toEqual([
      'begin transaction',
      'drop table if exists "Orders"',
      expect.stringMatching(/^alter table .* rename to "Orders"$/),
      'commit',
    ]);
    expect(dropFile).toHaveBeenCalledOnce();
  });
});
