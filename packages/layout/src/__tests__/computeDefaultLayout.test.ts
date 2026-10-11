import type {LayoutNode} from '@sqlrooms/layout-config';
import {
  computeDefaultLayout,
  parsePercentSize,
} from '../node-renderers/split-node-renderer/computeDefaultLayout';

function panel(
  id: string,
  extra: Partial<Extract<LayoutNode, {type: 'panel'}>> = {},
): LayoutNode {
  return {type: 'panel', id, ...extra};
}

describe('computeDefaultLayout', () => {
  it('honours percentage sizes and zeroes collapsed panels', () => {
    const layout = computeDefaultLayout([
      panel('a', {defaultSize: '30%'}),
      panel('b', {defaultSize: '70%'}),
    ]);
    expect(layout).toEqual({a: 30, b: 70});
  });

  it('treats unitless numeric strings as percentages', () => {
    const layout = computeDefaultLayout([
      panel('a', {defaultSize: '30'}),
      panel('b', {defaultSize: '70'}),
    ]);
    expect(layout).toEqual({a: 30, b: 70});
  });

  it.each(['-1%', '101%', '-1', '101'])(
    'rejects an out-of-range percentage size of %s',
    (defaultSize) => {
      expect(parsePercentSize(defaultSize)).toBeUndefined();
    },
  );

  it('zeroes a collapsed percentage panel and normalizes the visible one to 100', () => {
    const layout = computeDefaultLayout([
      panel('a', {defaultSize: '70%', collapsed: true}),
      panel('b', {defaultSize: '30%'}),
    ]);
    expect(layout).toEqual({a: 0, b: 100});
  });

  it('distributes unset sizes evenly', () => {
    const layout = computeDefaultLayout([panel('a'), panel('b')]);
    expect(layout).toEqual({a: 50, b: 50});
  });

  it('does not zero an unsized visible panel when declared sizes fill the group', () => {
    const layout = computeDefaultLayout([
      panel('existing', {defaultSize: '100%'}),
      panel('new-panel'),
    ]);

    expect(layout).toBeUndefined();
  });

  it('does not emit a layout when a visible panel has a numeric (pixel) size', () => {
    // A 250px sidebar must keep its pixel width, not be rewritten to a percent
    // by the group-level percentage layout.
    const layout = computeDefaultLayout([
      panel('sidebar', {defaultSize: 250}),
      panel('main'),
    ]);
    expect(layout).toBeUndefined();
  });

  it('does not emit a layout when a visible panel has a px string size', () => {
    const layout = computeDefaultLayout([
      panel('sidebar', {defaultSize: '250px'}),
      panel('main'),
    ]);
    expect(layout).toBeUndefined();
  });

  it.each(['20rem', '12em', '50vh', '25vw'])(
    'does not emit a layout when a visible panel uses %s',
    (defaultSize) => {
      const layout = computeDefaultLayout([
        panel('sidebar', {defaultSize}),
        panel('main'),
      ]);
      expect(layout).toBeUndefined();
    },
  );

  it('still emits an anti-flash layout when the pixel panel is collapsed', () => {
    // The pixel panel is collapsed, so it is not "visible" and cannot be
    // distorted; the group still gets its already-collapsed first-frame layout.
    const layout = computeDefaultLayout([
      panel('sidebar', {defaultSize: 250, collapsed: true}),
      panel('main'),
    ]);
    expect(layout).toEqual({sidebar: 0, main: 100});
  });

  it('does not replace a non-zero collapsed size with zero', () => {
    const layout = computeDefaultLayout([
      panel('sidebar', {
        defaultSize: '30%',
        collapsed: true,
        collapsedSize: 44,
      }),
      panel('main', {defaultSize: '70%'}),
    ]);

    expect(layout).toBeUndefined();
  });

  it('can encode an explicitly zero collapsed size', () => {
    const layout = computeDefaultLayout([
      panel('sidebar', {
        defaultSize: '30%',
        collapsed: true,
        collapsedSize: '0px',
      }),
      panel('main', {defaultSize: '70%'}),
    ]);

    expect(layout).toEqual({sidebar: 0, main: 100});
  });
});
