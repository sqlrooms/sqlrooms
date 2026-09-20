import {describe, expect, it} from '@jest/globals';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {blockDocumentBlockToNode} from '@sqlrooms/documents';
import {
  renderSourceError,
  isRoomieRenderTable,
  validateWorkspaceRenderSources,
} from '../renderSources';
import type {RoomState} from '../store';

function database() {
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
  return {
    currentDatabase: 'workspace',
    findTable: (name: string) =>
      tables.find((table) => table.table.table === name),
  };
}

describe('Roomie analytical sources', () => {
  it('admits current physical tables and temporary tables, including an unconfigured placeholder', () => {
    const db = database();
    for (const source of ['events', 'scratch', undefined, ''])
      expect(renderSourceError(db, source)).toBeUndefined();
  });

  it.each([
    'external_view',
    'attached_table',
    '__roomie',
    '__ROOMIE',
    "read_csv('/tmp/private.csv')",
  ])('blocks an unverified source before rendering: %s', (source) =>
    expect(renderSourceError(database(), source)).toContain('physical table'),
  );

  it('filters views and attached tables before shared selectors choose a fallback', () => {
    const db = database();
    const visible = ['external_view', 'attached_table', 'events'].filter(
      (name) => {
        const metadata = db.findTable(name)!;
        return isRoomieRenderTable(
          metadata.table,
          metadata,
          db.currentDatabase,
        );
      },
    );
    expect(visible).toEqual(['events']);
  });

  it('validates every document chart/table and dashboard source during hydration', () => {
    const state = (
      tableName: string,
      chart: boolean,
      dashboardTable?: string,
    ) =>
      ({
        db: database(),
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
    expect(() =>
      validateWorkspaceRenderSources(state('events', true, 'events')),
    ).not.toThrow();
    expect(() =>
      validateWorkspaceRenderSources(state('external_view', true)),
    ).toThrow('physical table');
    expect(() =>
      validateWorkspaceRenderSources(state('external_view', false)),
    ).toThrow('physical table');
    expect(() =>
      validateWorkspaceRenderSources(state('events', true, 'external_view')),
    ).toThrow('physical table');
    const remembered = state('events', true);
    remembered.mosaicDashboard.config.dashboardsById.dashboard.lastSelectedTable =
      'external_view';
    expect(() => validateWorkspaceRenderSources(remembered)).toThrow(
      'physical table',
    );
  });
});
