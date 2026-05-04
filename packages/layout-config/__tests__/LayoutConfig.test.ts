// In packages/layout-config/__tests__/LayoutConfig.test.ts
import {
  LayoutNode,
  isLayoutDockNode,
  isLayoutGridNode,
} from '../src/LayoutConfig';
import type {LayoutDockNode, LayoutGridNode} from '../src/LayoutConfig';
import {getLayoutNodeId as getTabsHelperLayoutNodeId} from '../src/tabs-helpers';

describe('LayoutDockNode schema', () => {
  test('accepts dock node with minimal props', () => {
    const node = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard-1',
      root: {type: 'panel', id: 'chart-1', panel: 'chart-1'},
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });

  test('accepts dock node with panel string', () => {
    const node = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard',
      root: {type: 'panel', id: 'chart-1', panel: 'chart-1'},
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });

  test('accepts dock node with panel object', () => {
    const node = {
      type: 'dock',
      id: 'dashboard-1',
      panel: {key: 'dashboard', meta: {dashboardId: 'overview'}},
      root: {type: 'panel', id: 'chart-1', panel: 'chart-1'},
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });

  test('accepts dock node with sizing props', () => {
    const node = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard-1',
      root: {type: 'panel', id: 'chart-1', panel: 'chart-1'},
      defaultSize: '50%',
      minSize: 300,
      collapsible: true,
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });

  test('rejects dock node without root', () => {
    const node = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard-1',
    };
    expect(() => LayoutNode.parse(node)).toThrow();
  });
});

describe('isLayoutDockNode type guard', () => {
  test('returns true for dock nodes', () => {
    const node: LayoutDockNode = {
      type: 'dock',
      id: 'dashboard-1',
      panel: 'dashboard-1',
      root: {type: 'panel', id: 'chart-1', panel: 'chart-1'},
    };

    expect(isLayoutDockNode(node)).toBe(true);
  });

  test('returns false for other node types', () => {
    expect(isLayoutDockNode({type: 'panel', id: 'p1', panel: 'p1'})).toBe(
      false,
    );
    expect(
      isLayoutDockNode({
        type: 'split',
        id: 's1',
        direction: 'row',
        children: [],
      }),
    ).toBe(false);
    expect(isLayoutDockNode('panel-key')).toBe(false);
    expect(isLayoutDockNode(null)).toBe(false);
  });
});

describe('LayoutGridNode schema', () => {
  test('accepts grid node with minimal props', () => {
    const node = {
      type: 'grid',
      id: 'dashboard-grid-1',
      panel: {key: 'dashboard', meta: {dashboardId: 'growth'}},
      children: [{type: 'panel', id: 'chart-1', panel: 'chart'}],
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });

  test('accepts grid node with layout props', () => {
    const node = {
      type: 'grid',
      id: 'dashboard-grid-1',
      panel: 'dashboard',
      cols: 12,
      rowHeight: 220,
      margin: [12, 12],
      compactType: 'vertical',
      resizeHandles: ['e', 's', 'se'],
      children: [{type: 'panel', id: 'chart-1', panel: 'chart'}],
      layouts: {
        lg: [{i: 'chart-1', x: 0, y: 0, w: 6, h: 2}],
      },
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });
});

describe('isLayoutGridNode type guard', () => {
  test('returns true for grid nodes', () => {
    const node: LayoutGridNode = {
      type: 'grid',
      id: 'dashboard-grid-1',
      panel: 'dashboard',
      children: [{type: 'panel', id: 'chart-1', panel: 'chart'}],
    };

    expect(isLayoutGridNode(node)).toBe(true);
  });

  test('returns false for other node types', () => {
    expect(isLayoutGridNode({type: 'panel', id: 'p1', panel: 'p1'})).toBe(
      false,
    );
    expect(isLayoutGridNode('panel-key')).toBe(false);
    expect(isLayoutGridNode(null)).toBe(false);
  });
});

describe('getLayoutNodeId', () => {
  test('returns id for grid nodes', () => {
    const node: LayoutGridNode = {
      type: 'grid',
      id: 'dashboard-grid-1',
      panel: 'dashboard',
      children: [],
    };

    expect(getTabsHelperLayoutNodeId(node)).toBe('dashboard-grid-1');
  });
});

describe('LayoutPanelNode with panel identity', () => {
  test('accepts panel node with panel string', () => {
    const node = {
      type: 'panel',
      id: 'chart-1',
      panel: 'chart',
    };
    const parsed = LayoutNode.parse(node);
    expect(parsed).toMatchObject({panel: 'chart'});
  });

  test('accepts panel node with panel object', () => {
    const node = {
      type: 'panel',
      id: 'chart-1',
      panel: {key: 'chart', meta: {chartId: 'overview-users'}},
    };
    const parsed = LayoutNode.parse(node);
    expect(parsed).toMatchObject({
      panel: {key: 'chart', meta: {chartId: 'overview-users'}},
    });
  });

  test('accepts panel node without panel property', () => {
    const node = {
      type: 'panel',
      id: 'chart-1',
    };
    expect(() => LayoutNode.parse(node)).not.toThrow();
  });
});

describe('Schema rejects deprecated properties', () => {
  test('rejects pathSegment on split nodes', () => {
    const node = {
      type: 'split',
      id: 'split-1',
      direction: 'row',
      pathSegment: false,
      children: ['panel-1'],
    };
    expect(() => LayoutNode.parse(node)).toThrow();
  });

  test('rejects draggable on split nodes', () => {
    const node = {
      type: 'split',
      id: 'split-1',
      direction: 'row',
      draggable: true,
      children: ['panel-1'],
    };
    expect(() => LayoutNode.parse(node)).toThrow();
  });

  test('rejects pathSegment on tabs nodes', () => {
    const node = {
      type: 'tabs',
      id: 'tabs-1',
      activeTabIndex: 0,
      pathSegment: false,
      children: ['panel-1'],
    };
    expect(() => LayoutNode.parse(node)).toThrow();
  });

  test('rejects draggable on tabs nodes', () => {
    const node = {
      type: 'tabs',
      id: 'tabs-1',
      activeTabIndex: 0,
      draggable: true,
      children: ['panel-1'],
    };
    expect(() => LayoutNode.parse(node)).toThrow();
  });
});
