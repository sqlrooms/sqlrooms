import type {LayoutNode} from '@sqlrooms/layout-config';
import {computeDefaultLayout} from '../node-renderers/split-node-renderer/computeDefaultLayout';

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

  it('distributes unset sizes evenly', () => {
    const layout = computeDefaultLayout([panel('a'), panel('b')]);
    expect(layout).toEqual({a: 50, b: 50});
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

  it('still emits an anti-flash layout when the pixel panel is collapsed', () => {
    // The pixel panel is collapsed, so it is not "visible" and cannot be
    // distorted; the group still gets its already-collapsed first-frame layout.
    const layout = computeDefaultLayout([
      panel('sidebar', {defaultSize: 250, collapsed: true}),
      panel('main'),
    ]);
    expect(layout).toEqual({sidebar: 0, main: 100});
  });
});
