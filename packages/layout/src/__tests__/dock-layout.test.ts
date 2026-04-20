import {LayoutNode} from '@sqlrooms/layout-config';
import {movePanel} from '../docking/dock-layout';

describe('movePanel', () => {
  it('inserts a sibling into a same-axis split with equalized sizes when needed', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: ['a', 'b', 'c'],
      },
    };

    const result = movePanel(input, 'a', 'b', 'right');

    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: [
          {type: 'panel', id: 'b', defaultSize: '33.3333%'},
          {type: 'panel', id: 'a', defaultSize: '33.3333%'},
          {type: 'panel', id: 'c', defaultSize: '33.3333%'},
        ],
      },
    });
  });

  it('wraps only the hovered child when the drop axis conflicts with the parent split', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: ['a', 'b', 'c'],
      },
    };

    const result = movePanel(input, 'a', 'b', 'down');

    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: [
          {
            type: 'split',
            direction: 'column',
            children: [
              {type: 'panel', id: 'b', defaultSize: '50%'},
              {type: 'panel', id: 'a', defaultSize: '50%'},
            ],
          },
          'c',
        ],
      },
    });
  });

  it('preserves dock container when reordering inside a two-child split', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'row',
        children: ['left', 'right'],
      },
    };

    const result = movePanel(input, 'left', 'right', 'right');

    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'row',
        children: [
          {type: 'panel', id: 'right', defaultSize: '50%'},
          {type: 'panel', id: 'left', defaultSize: '50%'},
        ],
      },
    });
  });

  it('replaces a single-child parent split when a cross-axis drop changes direction', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'row',
        children: ['left', 'right'],
      },
    };

    const result = movePanel(input, 'left', 'right', 'down');

    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'column',
        children: [
          {type: 'panel', id: 'right', defaultSize: '50%'},
          {type: 'panel', id: 'left', defaultSize: '50%'},
        ],
      },
    });
  });

  it('removes the source from tabs and keeps a valid activeTabIndex', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: [
          {
            type: 'tabs',
            id: 'dashboards',
            activeTabIndex: 1,
            children: ['alpha', 'beta', 'gamma'],
          },
          'target',
        ],
      },
    };

    const result = movePanel(input, 'beta', 'target', 'right');

    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'root',
        direction: 'row',
        children: [
          {
            type: 'tabs',
            id: 'dashboards',
            activeTabIndex: 1,
            children: ['alpha', 'gamma'],
          },
          {type: 'panel', id: 'target', defaultSize: '33.3333%'},
          {type: 'panel', id: 'beta', defaultSize: '33.3333%'},
        ],
      },
    });
  });

  it('keeps the third sibling when chaining cross-axis moves in a three-panel column', () => {
    const input: LayoutNode = {
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'column',
        children: ['first', 'second', 'third'],
      },
    };

    const afterFirstMove = movePanel(input, 'third', 'second', 'right');
    expect(afterFirstMove).toMatchObject({
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'column',
        children: [
          'first',
          {
            type: 'split',
            direction: 'row',
            children: [
              {type: 'panel', id: 'second', defaultSize: '50%'},
              {type: 'panel', id: 'third', defaultSize: '50%'},
            ],
          },
        ],
      },
    });

    const afterSecondMove = movePanel(
      afterFirstMove,
      'first',
      'second',
      'down',
    );

    expect(afterSecondMove).toMatchObject({
      type: 'dock',
      id: 'dashboard',
      root: {
        type: 'split',
        direction: 'row',
        children: [
          {
            type: 'split',
            direction: 'column',
            children: [
              {type: 'panel', id: 'second', defaultSize: '50%'},
              {type: 'panel', id: 'first', defaultSize: '50%'},
            ],
          },
          {type: 'panel', id: 'third'},
        ],
      },
    });
  });

  it('does not move panel outside dock boundary', () => {
    const layout: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'row',
      children: [
        {type: 'panel', id: 'sidebar'},
        {
          type: 'dock',
          id: 'dashboard-1',
          root: {type: 'panel', id: 'chart-1'},
        },
      ],
    };
    // Attempt to move chart-1 to sidebar should fail and return original layout
    const result = movePanel(layout, 'chart-1', 'sidebar', 'left');
    expect(result).toBe(layout);
  });

  it('does not move panel between different docks', () => {
    const layout: LayoutNode = {
      type: 'split',
      id: 'root',
      direction: 'row',
      children: [
        {
          type: 'dock',
          id: 'dashboard-1',
          root: {type: 'panel', id: 'chart-1'},
        },
        {
          type: 'dock',
          id: 'dashboard-2',
          root: {type: 'panel', id: 'chart-2'},
        },
      ],
    };
    // Attempt to move chart-1 to chart-2 (different docks) should fail
    const result = movePanel(layout, 'chart-1', 'chart-2', 'right');
    expect(result).toBe(layout);
  });

  it('moves panel within dock root', () => {
    const layout: LayoutNode = {
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'row',
        children: [
          {type: 'panel', id: 'chart-1'},
          {type: 'panel', id: 'chart-2'},
        ],
      },
    };
    const result = movePanel(layout, 'chart-1', 'chart-2', 'right');
    expect(result).toMatchObject({
      type: 'dock',
      id: 'dashboard-1',
      root: {
        type: 'split',
        id: 'split-1',
        direction: 'row',
        children: [
          {type: 'panel', id: 'chart-2', defaultSize: '50%'},
          {type: 'panel', id: 'chart-1', defaultSize: '50%'},
        ],
      },
    });
  });
});
