import {describe, expect, it} from '@jest/globals';
import {defineScenario} from '../scenario';

describe('behavioral scenarios', () => {
  it('expresses compatible profiles and target-neutral outcomes', () => {
    const scenario = defineScenario({
      id: 'document.create-chart-map',
      version: 1,
      title: 'Create chart and map',
      compatibleProfiles: ['document-charts-maps'],
      fixture: {database: 'ambiguous-geospatial'},
      turns: [{id: 'create', input: 'Create a document.'}],
      expectations: [
        {
          oracleId: 'workspace-chart-map',
          description: 'Chart and map blocks exist in one document.',
        },
      ],
      metadata: {owner: 'sqlrooms'},
    });

    expect(scenario.compatibleProfiles).toEqual(['document-charts-maps']);
    expect(scenario.expectations[0]).toEqual({
      oracleId: 'workspace-chart-map',
      description: 'Chart and map blocks exist in one document.',
      config: {},
    });
  });

  it('rejects unstable scenario identifiers and empty turns', () => {
    expect(() =>
      defineScenario({
        id: 'Document Create',
        version: 1,
        title: 'Invalid',
        compatibleProfiles: ['default'],
        turns: [],
        expectations: [],
      }),
    ).toThrow('Scenario IDs');
  });

  it('allocates fresh object defaults for every parsed scenario', () => {
    const input = {
      id: 'document.defaults',
      version: 1,
      title: 'Fresh defaults',
      compatibleProfiles: ['default'],
      turns: [{id: 'verify', input: 'Verify defaults.'}],
      expectations: [
        {oracleId: 'workspace', description: 'Workspace is valid.'},
      ],
    };

    const first = defineScenario(input);
    const second = defineScenario(input);

    expect(first.fixture).not.toBe(second.fixture);
    expect(first.metadata).not.toBe(second.metadata);
    expect(first.expectations[0]?.config).not.toBe(
      second.expectations[0]?.config,
    );
  });
});
