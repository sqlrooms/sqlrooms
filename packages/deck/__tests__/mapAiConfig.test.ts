import {describe, expect, test} from '@jest/globals';
import {
  DeckMapResourceConfigParameter,
  DeckMapResourceToolParameters,
} from '../src/mapAiConfig';

describe('DeckMapResourceConfigParameter', () => {
  test('accepts table-backed and SQL dataset sources', () => {
    const result = DeckMapResourceConfigParameter.safeParse({
      spec: {layers: []},
      datasets: {
        tableData: {
          source: {
            tableName: 'places',
            transformSql: 'SELECT * FROM __sqlrooms_source',
          },
        },
        queryData: {source: {sqlQuery: 'SELECT * FROM places'}},
      },
    });

    expect(result.success).toBe(true);
  });

  test('rejects dataset sources without a table or SQL query', () => {
    const result = DeckMapResourceConfigParameter.safeParse({
      spec: {layers: []},
      datasets: {
        invalid: {source: {transformSql: 'SELECT * FROM __sqlrooms_source'}},
      },
    });

    expect(result.success).toBe(false);
  });

  test('accepts an explicit layer replacement request', () => {
    const result = DeckMapResourceToolParameters.safeParse({
      title: 'Places',
      reasoning: 'Remove a broken layer',
      replaceLayers: true,
      config: {
        spec: {layers: []},
        datasets: {},
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.replaceLayers).toBe(true);
  });
});
