import {describe, expect, it} from '@jest/globals';
import {defineScenario} from '../scenario';

describe('behavioral scenarios', () => {
  it('expresses compatible profiles and target-neutral outcomes', () => {
    const scenario = defineScenario({
      id: 'worksheet.create-chart-map',
      version: 1,
      title: 'Create chart and map',
      compatibleProfiles: ['worksheet-charts-maps'],
      fixture: {database: 'ambiguous-geospatial'},
      turns: [{id: 'create', input: 'Create a worksheet.'}],
      expectations: [
        {
          oracleId: 'workspace-chart-map',
          description: 'Chart and map blocks exist in one worksheet.',
        },
      ],
      metadata: {owner: 'sqlrooms'},
    });

    expect(scenario.compatibleProfiles).toEqual(['worksheet-charts-maps']);
    expect(scenario.expectations[0]).toEqual({
      oracleId: 'workspace-chart-map',
      description: 'Chart and map blocks exist in one worksheet.',
      config: {},
    });
  });

  it('rejects unstable scenario identifiers and empty turns', () => {
    expect(() =>
      defineScenario({
        id: 'Worksheet Create',
        version: 1,
        title: 'Invalid',
        compatibleProfiles: ['default'],
        turns: [],
        expectations: [],
      }),
    ).toThrow('Scenario IDs');
  });
});
