// In packages/layout-config/__tests__/LayoutConfig.test.ts
import {
  LayoutDockNode,
  LayoutNode,
  isLayoutDockNode,
} from '../src/LayoutConfig';

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
