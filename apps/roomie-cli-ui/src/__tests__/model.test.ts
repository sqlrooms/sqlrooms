import {describe, expect, it} from '@jest/globals';
import {
  blockDocumentBlockToNode,
  type BlockDocumentNode,
} from '@sqlrooms/documents';
import {Workspace, TableSettings, ROOMIE_CAPABILITIES} from '../model';
import {createDefaultChartTypes} from '@sqlrooms/mosaic';

function workspace(nodes: BlockDocumentNode[] = []) {
  return {
    application: 'roomie',
    schemaVersion: 1,
    artifacts: {
      artifactsById: {
        document: {id: 'document', type: 'block-document', title: 'Document'},
      },
    },
    blockDocuments: {
      artifacts: {
        document: {id: 'document', content: {type: 'doc', content: nodes}},
      },
    },
    mosaicDashboard: {},
    htmlApps: {},
    tableExplorers: {byId: {'table-instance': TableSettings.parse({})}},
  };
}

const tableBlock = (id: string, ownership: 'owned' | 'external' = 'owned') =>
  blockDocumentBlockToNode({
    id,
    type: 'statefulBlock',
    blockType: 'data-table',
    blockInstanceId: 'table-instance',
    ownership,
  });

describe('Roomie workspace validation', () => {
  it('keeps the visible chart registry aligned with the fixed product manifest', () => {
    expect(
      createDefaultChartTypes({includeCustomSpec: false})
        .map((chart) => chart.id)
        .sort(),
    ).toEqual([...ROOMIE_CAPABILITIES.chartTypes].sort());
  });

  it('round-trips a document workspace and table preferences', () => {
    const saved = Workspace.parse(workspace([tableBlock('table')]));
    saved.tableExplorers.byId['table-instance'] = TableSettings.parse({
      columns: ['city', 'value'],
      sorting: [{id: 'value', desc: true}],
      pageSize: 100,
    });
    expect(Workspace.parse(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('rejects foreign applications, future versions, and unknown slices', () => {
    expect(
      Workspace.safeParse({...workspace(), application: 'sqlrooms'}).success,
    ).toBe(false);
    expect(
      Workspace.safeParse({...workspace(), schemaVersion: 2}).success,
    ).toBe(false);
    expect(
      Workspace.safeParse({...workspace(), futureFeature: {important: true}})
        .success,
    ).toBe(false);
  });

  it('rejects unsupported top-level artifacts', () => {
    const saved = workspace();
    saved.artifacts.artifactsById.document.type = 'dashboard';
    expect(Workspace.safeParse(saved).success).toBe(false);
  });

  it.each([
    {type: 'futureWidget', attrs: {id: 'future', payload: 'keep me'}},
    {
      type: 'blockDocumentStatefulBlock',
      attrs: {id: 'broken', blockType: 'data-table'},
    },
    {
      type: 'paragraph',
      attrs: {id: 'paragraph'},
      content: [{type: 'futureInline', attrs: {payload: 'keep me'}}],
    },
  ])(
    'rejects unknown or malformed document content before enabling saves: $type',
    (node) => {
      expect(Workspace.safeParse(workspace([node])).success).toBe(false);
    },
  );

  it('rejects maps, referenced blocks, and duplicated backing instances', () => {
    const map = tableBlock('map');
    map.attrs = {...map.attrs, blockType: 'map'};
    expect(Workspace.safeParse(workspace([map])).success).toBe(false);
    expect(
      Workspace.safeParse(workspace([tableBlock('reference', 'external')]))
        .success,
    ).toBe(false);
    expect(
      Workspace.safeParse(workspace([tableBlock('one'), tableBlock('two')]))
        .success,
    ).toBe(false);
  });

  it('rejects unsupported dashboard panels and chart types', () => {
    const base = Workspace.parse(workspace());
    for (const panel of [
      {id: 'panel', type: 'map', title: 'Map', config: {}},
      {
        id: 'panel',
        type: 'vgplot',
        title: 'Future chart',
        config: {chartType: 'future-chart', settings: {}},
      },
      {
        id: 'custom',
        type: 'vgplot',
        title: 'Custom spec',
        config: {chartType: 'custom-spec', settings: {vgPlotSpec: {plot: []}}},
      },
    ]) {
      expect(
        Workspace.safeParse({
          ...base,
          mosaicDashboard: {
            dashboardsById: {dashboard: {id: 'dashboard', panels: [panel]}},
          },
        }).success,
      ).toBe(false);
    }
  });

  it('rejects saved custom-spec document charts before enabling writes', () => {
    expect(ROOMIE_CAPABILITIES.chartTypes).not.toContain('custom-spec');
    const node = blockDocumentBlockToNode({
      id: 'custom',
      type: 'chart',
      tableName: 'events',
      config: {
        chartType: 'custom-spec',
        settings: {vgPlotSpec: {data: {external: {file: '/tmp/private.csv'}}}},
      },
    });
    expect(Workspace.safeParse(workspace([node])).success).toBe(false);
  });
});
