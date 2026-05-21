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

  it('resolves dataset source before dashboard fallback source', () => {
    const dashboard = createDashboard('dashboard_table');
    const panel = createDeckMapDashboardPanelConfig({
      spec: {layers: []},
      datasets: {
        dataset: {
          source: {sqlQuery: 'SELECT * FROM dataset_table'},
        },
      },
    });

    // Dataset source has priority
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

  it('builds Mosaic dataset queries for table and trusted SQL sources', () => {
    const tableSql = createDeckMapDashboardDatasetQuery(
      {tableName: 'earthquakes'},
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
