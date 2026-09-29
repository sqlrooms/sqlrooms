import type {ScenarioDefinition} from '@sqlrooms/evals';
import type {StoreApi} from 'zustand';
import type {CliDomainState} from '../createCliDomainSlice';

/** Resolves the existing scenario workspace fixture. */
export function fixtureWorkspaceMode(
  scenario: ScenarioDefinition,
): 'empty' | 'document' | 'document-chart-map' {
  const mode = scenario.fixture.workspace;
  if (
    mode === 'empty' ||
    mode === 'document' ||
    mode === 'document-chart-map'
  ) {
    return mode;
  }
  return 'document';
}

/** Seeds stable document/block/map identities before either evaluation target runs. */
export function seedDocument(
  store: Pick<
    StoreApi<Pick<CliDomainState, 'artifacts' | 'blockDocuments' | 'deckMaps'>>,
    'getState'
  >,
  scenario: ScenarioDefinition,
  repetition: number,
  mode: 'document' | 'document-chart-map',
): string {
  const documentId = store.getState().artifacts.createArtifact({
    id: `eval-${scenario.id}-${repetition}`,
    type: 'block-document',
    title: 'Evaluation Document',
  });
  store.getState().blockDocuments.ensureBlockDocument(documentId);
  if (mode === 'document-chart-map') {
    const mapId = `${documentId}-map`;
    store.getState().blockDocuments.appendBlocks(documentId, [
      {
        id: 'seed-heading',
        type: 'heading',
        level: 2,
        text: [{type: 'text', text: 'Existing analysis'}],
      },
      {
        id: 'seed-chart',
        type: 'chart',
        tableName: '"analytics"."events"',
        config: {
          chartType: 'bar',
          x: {field: 'category'},
          y: {field: 'metric', aggregate: 'sum'},
          title: 'Original metric chart',
        },
      },
      {
        id: 'seed-map-block',
        type: 'statefulBlock',
        blockType: 'map',
        blockInstanceId: mapId,
        ownership: 'owned',
        caption: 'Existing event map',
      },
    ]);
    store.getState().deckMaps.updateMap(mapId, {
      title: 'Existing event map',
      selectedTable: '"analytics"."events"',
      config: {
        datasets: {
          events: {source: {tableName: '"analytics"."events"'}},
        },
        spec: {
          layers: [
            {
              '@@type': 'GeoArrowScatterplotLayer',
              _sqlroomsBinding: {
                dataset: 'events',
                longitudeColumn: 'longitude',
                latitudeColumn: 'latitude',
              },
            },
          ],
        },
        fitToData: {
          dataset: 'events',
          longitudeColumn: 'longitude',
          latitudeColumn: 'latitude',
        },
      },
    });
  }
  return documentId;
}
