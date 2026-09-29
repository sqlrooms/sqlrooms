import {describe, expect, jest, test} from '@jest/globals';
import {BlockCaptionEditor} from '../../documents/src/components/BlockCaptionEditor';
import {BlockHeader} from '../../documents/src/components/BlockHeader';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ChartConfig} from '../src/charts/chart-types';

// The real caption/header primitives: this suite is about whether the chart
// block renders the same chrome the map block does.
jest.unstable_mockModule('@sqlrooms/documents', () => ({
  useBlockSettingsStore: () => undefined,
  BlockCaptionEditor,
  BlockHeader,
}));

const {ChartBlockHeader} =
  await import('../src/charts/block-document/ChartBlockHeader');

const chartConfig: ChartConfig = {
  chartType: 'histogram',
  settings: {field: 'amount'},
};

/** Class of the outermost element in the rendered markup. */
function rootClass(markup: string) {
  return markup.match(/^<[a-z]+[^>]*?\sclass="([^"]*)"/)?.[1];
}

/** Class of the first `<input>` in the rendered markup. */
function inputClass(markup: string) {
  return markup.match(/<input[^>]*?\sclass="([^"]*)"/)?.[1];
}

/**
 * Chart and map block headings drifted apart once. Pin the chart to the
 * shared primitives so the two can only ever change together.
 */
describe('chart block header', () => {
  test('uses the shared block header chrome', () => {
    const chart = renderToStaticMarkup(
      <ChartBlockHeader
        chartConfig={chartConfig}
        tableName="points"
        onSettingsOpenChange={() => {}}
      />,
    );
    const reference = renderToStaticMarkup(<BlockHeader>caption</BlockHeader>);
    expect(rootClass(chart)).toBeDefined();
    expect(rootClass(chart)).toBe(rootClass(reference));
  });

  test('uses the shared block caption styling', () => {
    const chart = renderToStaticMarkup(
      <ChartBlockHeader
        chartConfig={chartConfig}
        caption="My chart"
        tableName="points"
        onSettingsOpenChange={() => {}}
      />,
    );
    const reference = renderToStaticMarkup(
      <BlockCaptionEditor value="My chart" onChange={() => {}} />,
    );
    expect(inputClass(chart)).toBeDefined();
    expect(inputClass(chart)).toBe(inputClass(reference));
  });
});
