import {describe, expect, test} from '@jest/globals';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChartSelectorEmptyState} from '../src/charts/block-document/ChartSelectorEmptyState';

/**
 * A table-less chart block is valid (its config may carry SQL), and a Mosaic
 * chart whose table is gone is a normal document state. Both must say so rather
 * than show a bare picker that looks like an empty chart.
 */
describe('chart selector empty state', () => {
  test('explains why the table picker is showing', () => {
    const markup = renderToStaticMarkup(
      <ChartSelectorEmptyState
        tables={[]}
        message="This chart block has no table yet."
      />,
    );

    expect(markup).toContain('This chart block has no table yet.');
    expect(markup).toContain('Search tables...');
  });
});
