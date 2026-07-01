import {Table, vectorFromArray} from 'apache-arrow';
import {
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  resolveDeckMapDashboardDatasetSource,
  type DeckMapDashboardPanelConfig,
} from '../src/dashboardConfig';
import type {MosaicDashboardEntryType} from '@sqlrooms/mosaic';

function createDashboard(selectedTable?: string): MosaicDashboardEntryType {
  return {
    id: 'dashboard',
    title: 'Dashboard',
    ...(selectedTable ? {selectedTable} : {}),
    panels: [],
    layout: null,
    updatedAt: 0,
  };
}

describe('deck dashboard integration', () => {
  it('creates serializable dashboard map panel configs', () => {
    const panel = createDeckMapDashboardPanelConfig({
      title: 'Earthquakes',
      spec: {layers: []},
      datasets: {
        earthquakes: {
          source: {tableName: 'earthquakes'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      showLegends: false,
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
    });

    expect(panel.type).toBe(DECK_MAP_DASHBOARD_PANEL_TYPE);
    expect(panel.title).toBe('Earthquakes');
    expect(panel.config).toEqual({
      spec: {layers: []},
      datasets: {
        earthquakes: {
          source: {tableName: 'earthquakes'},
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
      showLegends: false,
      fitToData: {
        dataset: 'earthquakes',
        longitudeColumn: 'Longitude',
        latitudeColumn: 'Latitude',
      },
    });
  });

  it('keeps literal dataset sqlQuery pinned when dashboard.selectedTable changes', () => {
    const dashboard = createDashboard('dashboard_table');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {
        dataset: {
          source: {sqlQuery: 'SELECT * FROM dataset_table'},
        },
      },
    });

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {
          source: {sqlQuery: 'SELECT * FROM dataset_table'},
        },
      }),
    ).toEqual({sqlQuery: 'SELECT * FROM dataset_table'});

    // Falls back to dashboard source when no dataset source
    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {},
      }),
    ).toEqual({tableName: 'dashboard_table'});
  });

  it('resolves table dataset inputs with dashboard.selectedTable', () => {
    const dashboard = createDashboard('dashboard_table');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {
        dataset: {
          source: {
            tableName: 'dataset_table',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
          },
        },
      },
    });

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {
          source: {
            tableName: 'dataset_table',
            transformSql:
              'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
          },
        },
      }),
    ).toEqual({
      tableName: 'dashboard_table',
      transformSql:
        'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
    });
  });

  it('omits catalog-qualified selected table identities in structured map runtime SQL', () => {
    const dashboard = createDashboard('"memory"."main"."events.2026"');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {},
    });

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {
          source: {tableName: '"main"."old.events"'},
        },
      }),
    ).toEqual({tableName: '"main"."events.2026"'});

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {},
      }),
    ).toEqual({tableName: '"main"."events.2026"'});

    const tableSql = createDeckMapDashboardDatasetQuery(
      {tableName: '"main"."events.2026"'},
      [],
    ).toString();
    expect(tableSql).toContain('FROM "main"."events.2026"');
    expect(tableSql).not.toContain('"events"."2026"');
  });

  it('does not rewrite literal SQL containing nested FROM clauses', () => {
    const dashboard = createDashboard('"memory"."main"."events.2026"');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {},
    });

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {
          source: {
            sqlQuery:
              'WITH nested AS (SELECT * FROM other_table) SELECT * FROM "memory"."main"."old.events" WHERE value > 0',
          },
        },
      }),
    ).toEqual({
      sqlQuery:
        'WITH nested AS (SELECT * FROM other_table) SELECT * FROM "memory"."main"."old.events" WHERE value > 0',
    });
  });

  it('strips catalog-qualified structured source tables', () => {
    const dashboard = createDashboard('"memory"."main"."events"');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {},
    });

    expect(
      resolveDeckMapDashboardDatasetSource({
        dashboard,
        panel,
        dataset: {
          source: {
            tableName: '"memory"."main"."events"',
          },
        },
      }),
    ).toEqual({tableName: '"main"."events"'});
  });

  it('builds Mosaic dataset queries for table, transform, and trusted SQL sources', () => {
    const tableSql = createDeckMapDashboardDatasetQuery(
      {tableName: 'earthquakes'},
      [],
    ).toString();
    const transformSql = createDeckMapDashboardDatasetQuery(
      {
        tableName: 'earthquakes',
        transformSql:
          'SELECT *, ST_AsWKB(ST_Point(lon, lat)) AS geom FROM __sqlrooms_source',
      },
      [],
    ).toString();
    const subquerySql = createDeckMapDashboardDatasetQuery(
      {sqlQuery: 'SELECT * FROM earthquakes WHERE Magnitude > 4'},
      [],
    ).toString();

    expect(tableSql).toContain('FROM "earthquakes"');
    expect(tableSql).toContain('SELECT *');
    expect(subquerySql).toContain('SELECT *');
    expect(subquerySql).toContain(
      'FROM (SELECT * FROM earthquakes WHERE Magnitude > 4)',
    );
    expect(transformSql).toContain('WITH __sqlrooms_source AS');
    expect(transformSql).toContain('SELECT * FROM "earthquakes"');
    expect(transformSql).toContain('FROM __sqlrooms_source');
  });

  it('wires Arrow client results into DeckJsonMap dataset inputs', () => {
    const arrowTable = new Table({
      value: vectorFromArray([1, 2, 3]),
    });
    const config: DeckMapDashboardPanelConfig = {
      spec: {layers: []},
      datasets: {
        earthquakes: {
          geometryColumn: 'geom',
          geometryEncodingHint: 'wkb',
        },
      },
    };

    const datasets = createDeckMapDashboardDatasets(config, {
      earthquakes: {arrowTable},
    });

    expect(datasets.earthquakes).toEqual({
      arrowTable,
      geometryColumn: 'geom',
      geometryEncodingHint: 'wkb',
    });
  });
});
