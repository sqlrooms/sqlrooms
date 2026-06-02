import type {DuckDbConnector} from '@sqlrooms/duckdb';

export type WorkspaceDuckDbRuntime = {
  workspaceKey: string;
  connector: DuckDbConnector;
  listTables: () => Promise<string[]>;
  destroy: () => Promise<void>;
};

export function createWorkspaceDuckDbConnector(workspaceKey: string) {
  return import('@sqlrooms/duckdb').then(({createWasmDuckDbConnector}) =>
    createWasmDuckDbConnector({
      dbPath: ':memory:',
      initializationQuery: [
        'set enable_progress_bar = false',
        `create schema if not exists ${escapeIdentifier(workspaceKey)}`,
      ].join(';'),
    }),
  );
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function createWorkspaceDuckDbRuntime(
  workspaceKey: string,
): Promise<WorkspaceDuckDbRuntime> {
  const connector = await createWorkspaceDuckDbConnector(workspaceKey);
  await connector.initialize();

  return {
    workspaceKey,
    connector,
    async listTables() {
      const rows = await connector.queryJson<{table_name: string}>(
        "select table_name from information_schema.tables where table_schema = 'main' order by table_name",
      );
      return Array.from(rows, (row) => row.table_name);
    },
    async destroy() {
      await connector.destroy();
    },
  };
}
