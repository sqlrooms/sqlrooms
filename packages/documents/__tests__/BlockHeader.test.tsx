import {describe, expect, test} from '@jest/globals';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BlockHeader} from '../src/components/BlockHeader';

describe('BlockHeader', () => {
  test('renders actions in a trailing row', () => {
    const markup = renderToStaticMarkup(
      <BlockHeader actions={<button type="button">act</button>}>
        caption
      </BlockHeader>,
    );
    expect(markup).toContain('caption');
    expect(markup).toContain('act');
  });

  test('omits the actions row when there are none', () => {
    const markup = renderToStaticMarkup(<BlockHeader>caption</BlockHeader>);
    expect(markup).not.toContain('gap-0.5');
    expect(markup.match(/<div/g)).toHaveLength(1);
  });

  test('lets actionsClassName override the default actions gap', () => {
    const markup = renderToStaticMarkup(
      <BlockHeader actionsClassName="gap-2 overflow-hidden" actions={<span />}>
        caption
      </BlockHeader>,
    );
    const actionsRow = markup.match(/<div class="(flex shrink-0[^"]*)"/)?.[1];
    expect(actionsRow).toBe('flex shrink-0 items-center gap-2 overflow-hidden');
  });

  test('lets actionsClassName opt the actions row back into shrinking', () => {
    // Wide actions (a dashboard's table selector) must be able to compress and
    // clip rather than squeezing the caption to nothing.
    const markup = renderToStaticMarkup(
      <BlockHeader actionsClassName="shrink" actions={<span />}>
        caption
      </BlockHeader>,
    );
    const actionsRow = markup.match(/<div class="(flex [^"]*)"/)?.[1];
    expect(actionsRow).toBe('flex items-center gap-0.5 shrink');
  });
});
