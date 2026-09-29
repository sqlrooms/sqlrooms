import {expect, it} from '@jest/globals';
import {readFileSync} from 'node:fs';
import {ChartConfig} from '@sqlrooms/mosaic';

it('documents a chart configuration accepted by the production browser renderer', () => {
  const guide = readFileSync(
    new URL('../../skills/sqlrooms/references/charts.md', import.meta.url),
    'utf8',
  );
  const example = JSON.parse(guide.match(/```json\n([\s\S]*?)\n```/)![1]!);
  expect(ChartConfig.parse(example)).toMatchObject({
    chartType: 'count-plot',
    settings: {metric: 'aggregate', valueField: 'metric'},
  });
});
