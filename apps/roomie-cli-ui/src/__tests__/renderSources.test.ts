import {describe, expect, it} from '@jest/globals';
import {
  makeQualifiedTableName,
  parseQualifiedSqlIdentifier,
  type DataTable,
} from '@sqlrooms/duckdb';
import {blockDocumentBlockToNode} from '@sqlrooms/documents';
import {
  renderSourceError,
  isRoomieRenderTable,
  validateWorkspaceRenderSources,
  validateRenderSource,
  validateBlockRenderSources,
} from '../renderSources';
import type {RoomState} from '../RoomState';

function database(hideDisallowed = false) {
  const tables = [
    {name: 'events', database: 'workspace'},
    {name: 'scratch', database: 'temp'},
    {name: 'external_view', database: 'workspace', isView: true},
    {name: 'attached_table', database: 'attached'},
    {name: '__roomie', database: 'workspace'},
    {name: '__ROOMIE', database: 'workspace'},
  ].map(
    ({name, database, isView = false}) =>
      ({
        table: makeQualifiedTableName({database, schema: 'main', table: name}),
        schema: 'main',
        tableName: name,
        isView,
        columns: [],
      }) as DataTable,
  );
  const matches = (table: DataTable, name: string) => {
    const source = {
      database: 'workspace',
      schema: 'main',
      ...parseQualifiedSqlIdentifier(name),
    };
    return (
      table.table.table === source.table &&
      table.table.database === source.database &&
      table.table.schema === source.schema
    );
  };
  return {
    currentDatabase: 'workspace',
    findTable: (name: string) =>
      tables.find(
        (table) =>
          matches(table, name) &&
          (!hideDisallowed ||
            isRoomieRenderTable(table.table, table, 'workspace')),
      ),
    checkTableExists: async (name: string) =>
      tables.some((table) => matches(table, name)),
  };
}

describe('Roomie analytical sources', () => {
  it('admits current physical tables and temporary tables, including an unconfigured placeholder', () => {
    const db = database();
    for (const source of ['events', 'temp.main.scratch', undefined, ''])
      expect(renderSourceError(db, source)).toBeUndefined();
  });

  it.each([
    'external_view',
    'attached.main.attached_table',
    '__roomie',
    '__ROOMIE',
    "read_csv('/tmp/private.csv')",
  ])('blocks an unverified source before rendering: %s', (source) =>
    expect(renderSourceError(database(), source)).toContain('physical table'),
  );

  it('filters views and attached tables before shared selectors choose a fallback', () => {
    const db = database();
    const visible = [
      'external_view',
      'attached.main.attached_table',
      'events',
    ].filter((name) => {
      const metadata = db.findTable(name)!;
      return isRoomieRenderTable(metadata.table, metadata, db.currentDatabase);
    });
    expect(visible).toEqual(['events']);
  });

  it.each([false, true])(
    'validates saved sources with disallowed tables hidden: %s',
    async (hideDisallowed) => {
      const state = (
        tableName: string,
        chart: boolean,
        dashboardTable?: string,
      ) =>
        ({
          db: database(hideDisallowed),
          blockDocuments: {
            config: {
              artifacts: {
                document: {
                  id: 'document',
                  content: {
                    type: 'doc',
                    content: [
                      blockDocumentBlockToNode(
                        chart
                          ? {
                              id: 'chart',
                              type: 'chart',
                              tableName,
                              config: {
                                chartType: 'histogram',
                                settings: {field: 'value'},
                              },
                            }
                          : {
                              id: 'table',
                              type: 'statefulBlock',
                              blockType: 'data-table',
                              blockInstanceId: 'table',
                              tableName,
                            },
                      ),
                    ],
                  },
                },
              },
            },
          },
          mosaicDashboard: {
            config: {
              dashboardsById: {dashboard: {selectedTable: dashboardTable}},
            },
          },
        }) as unknown as RoomState;
      await expect(
        validateWorkspaceRenderSources(state('events', true, 'events')),
      ).resolves.toBeUndefined();
      for (const chart of [true, false]) {
        await expect(
          validateWorkspaceRenderSources(
            state('dropped_table', chart, 'dropped_table'),
          ),
        ).resolves.toBeUndefined();
      }
      const missingRemembered = state('events', true);
      missingRemembered.mosaicDashboard.config.dashboardsById.dashboard.lastSelectedTable =
        'dropped_table';
      await expect(
        validateWorkspaceRenderSources(missingRemembered),
      ).resolves.toBeUndefined();
      for (const source of [
        'attached.main.attached_table',
        '__roomie',
        '__ROOMIE',
      ]) {
        await expect(
          validateWorkspaceRenderSources(state(source, false)),
        ).rejects.toThrow('physical table');
      }
      await expect(
        validateWorkspaceRenderSources(state('external_view', true)),
      ).rejects.toThrow('physical table');
      await expect(
        validateWorkspaceRenderSources(state('external_view', false)),
      ).rejects.toThrow('physical table');
      await expect(
        validateWorkspaceRenderSources(state('events', true, 'external_view')),
      ).rejects.toThrow('physical table');
      const remembered = state('events', true);
      remembered.mosaicDashboard.config.dashboardsById.dashboard.lastSelectedTable =
        'external_view';
      await expect(validateWorkspaceRenderSources(remembered)).rejects.toThrow(
        'physical table',
      );
    },
  );

  it('keeps missing sources invalid for rendering and new block commands', () => {
    const db = database();
    expect(renderSourceError(db, 'dropped_table')).toContain('physical table');
    expect(() => validateRenderSource(db, 'dropped_table')).toThrow(
      'physical table',
    );
    expect(() =>
      validateBlockRenderSources(db, {
        id: 'table',
        type: 'statefulBlock',
        blockType: 'data-table',
        blockInstanceId: 'table',
        tableName: 'dropped_table',
      }),
    ).toThrow('physical table');
  });
});
